"""TEST-only OpenCV geometry experiment. No production scanner integration.

Install optional dependencies separately: opencv-python, numpy.
Original pixels are never overwritten. Returns a candidate, not verified format.
"""
def order_points(pts):
    import numpy as np
    p = np.asarray(pts, dtype="float32").reshape(4, 2)
    sums = p.sum(axis=1)
    diffs = np.diff(p, axis=1).reshape(-1)
    ordered = np.array([p[np.argmin(sums)], p[np.argmin(diffs)],
                        p[np.argmax(sums)], p[np.argmax(diffs)]], dtype="float32")
    if len({tuple(v) for v in ordered}) != 4:
        raise ValueError("Ambiguous corners")
    return ordered

def warp_card_candidate(image_path):
    import cv2
    import numpy as np
    img = cv2.imread(image_path)
    if img is None:
        return {"status": "needs_review", "reason": "image_unreadable"}
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:12]:
        if cv2.contourArea(contour) < img.shape[0] * img.shape[1] * .08:
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, .02 * perimeter, True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue
        try:
            tl, tr, br, bl = order_points(approx)
        except ValueError:
            continue
        width = max(np.linalg.norm(tr-tl), np.linalg.norm(br-bl))
        height = max(np.linalg.norm(bl-tl), np.linalg.norm(br-tr))
        if min(width, height) < 30:
            continue
        ratio = float(width / height)
        # Not a physical aspect ratio; projective foreshortening remains.
        if ratio > 1.15:
            label, target = "wide_card_or_open_booklet_candidate", (1000, 700)
        elif ratio < .50:
            label, target = "tall_card_or_vertical_booklet_candidate", (500, 1400)
        else:
            label, target = "standard_card_candidate", (500, 700)
        w, h = target
        dst = np.array([[0,0],[w-1,0],[w-1,h-1],[0,h-1]], dtype="float32")
        matrix = cv2.getPerspectiveTransform(np.array([tl,tr,br,bl]), dst)
        warped = cv2.warpPerspective(img, matrix, target)
        candidates.append({"status":"candidate_only","geometry":label,
                           "observed_edge_ratio":round(ratio,3),
                           "warped_image":warped,"corners":np.array([tl,tr,br,bl]).tolist()})
    return candidates[0] if candidates else {"status":"needs_review","reason":"no_reliable_four_corner_contour"}
