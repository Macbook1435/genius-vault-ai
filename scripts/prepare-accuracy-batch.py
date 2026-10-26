#!/usr/bin/env python3
"""Offline-only preparation. Original image IDs and hashes are mandatory.
Imported CDP labels are unverified source data, never accuracy ground truth.
No network, scan, approval, database, or billing calls exist in this script.
"""
import argparse, csv, hashlib, json, re, zipfile
from pathlib import Path

def prepare(archive, manifest, output):
    rows = list(csv.DictReader(Path(manifest).read_text(encoding='utf-8-sig').splitlines()))
    if len(rows) != 110:
        raise ValueError('Expected exactly 110 manifest rows')
    ids = [r['original_image_id'] for r in rows]
    if len(set(ids)) != 110 or any(not re.fullmatch(r'\d+', x) for x in ids):
        raise ValueError('Missing, invalid, or duplicate original image IDs')
    paired = []
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        images = [n for n in names if re.fullmatch(r'\d+-(front|back)\.jpg', n)]
        expected = {f'{i}-{side}.jpg' for i in ids for side in ('front','back')}
        if len(images) != 220 or set(images) != expected:
            raise ValueError('ZIP images do not match manifest IDs exactly')
        for r in rows:
            item = {'original_image_id':r['original_image_id'], 'csv_row':int(r['csv_row']),
                    'review_status':'unverified','approval_allowed':False,'auto_approved':False,
                    'source_labels_unverified':{k:r[k] for k in r if k.startswith('imported_')},
                    'ground_truth':None}
            for side in ('front','back'):
                name = f"{r['original_image_id']}-{side}.jpg"
                if r[f'{side}_filename'] != name:
                    raise ValueError('Filename/ID mismatch')
                data = z.read(name)
                digest = hashlib.sha256(data).hexdigest()
                if digest != r[f'{side}_sha256'] or not data.startswith(b'\xff\xd8\xff'):
                    raise ValueError('Image hash or JPEG signature mismatch: '+name)
                item[side] = {'filename':name, 'sha256':digest, 'size_bytes':len(data)}
            paired.append(item)
    report = {'mode':'offline_preparation', 'pairs':paired, 'pair_count':110,'image_count':220,
              'archive_sha256':hashlib.sha256(Path(archive).read_bytes()).hexdigest(),
              'manifest_sha256':hashlib.sha256(Path(manifest).read_bytes()).hexdigest(),
              'attempted_scans':0,'cost_ceiling_usd':0,'paid_execution_allowed':False,
              'suggested_pilot_size':5,'concurrency':1,'automatic_retries':0,
              'accuracy_score':None,'ground_truth_reviewed_count':0,
              'blockers':['Authenticated TEST preflight required','Verified maximum per-scan cost required',
                          'Independent reviewed labels required before reporting accuracy']}
    Path(output).write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--manifest',required=True);p.add_argument('--output',required=True)
    args=p.parse_args();result=prepare(args.archive,args.manifest,args.output)
    print(json.dumps({k:v for k,v in result.items() if k!='pairs'},indent=2))
