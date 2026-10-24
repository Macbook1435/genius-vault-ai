/**
 * TEST ONLY: authenticated CDP collection import.
 * Caller supplies a Supabase browser client, JSZip (or compatible loadAsync),
 * the original CDP ZIP File, and the validated manifest object.
 * No service-role key; never invoke against production.
 */
const TEST_PROJECT = 'upvklqpoekudqifydmwr';
const BUCKET = 'gv-test-collection-images';
function assert(ok, message) { if (!ok) throw new Error(message); }
function safeName(name) {
  assert(typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*\.jpe?g$/i.test(name), 'Unsafe or missing image name');
  return name;
}
function unwrap({ data, error }, label) {
  if (error) throw new Error(label + ': ' + error.message);
  return data;
}
export async function importCdpTestCollection({ supabase, JSZip, zipFile, manifest, onProgress = () => {} }) {
  const url = new URL(supabase.supabaseUrl);
  assert(url.hostname === TEST_PROJECT + '.supabase.co', 'Refusing non-test Supabase project');
  const auth = unwrap(await supabase.auth.getUser(), 'Authentication');
  const userId = auth?.user?.id;
  assert(userId && /^[a-f0-9-]{36}$/i.test(userId), 'Sign in before importing');
  assert(manifest?.schema === 'genius-vault-cdp-import-v1', 'Unsupported manifest');
  const rows = manifest.records;
  assert(Array.isArray(rows) && rows.length > 0 && rows.length <= 500, 'Invalid batch size');
  const batchKey = String(manifest.source_batch ?? '');
  assert(/^[A-Za-z0-9_-]{1,80}$/.test(batchKey), 'Invalid batch ID');
  const seen = new Set();
  const zip = await JSZip.loadAsync(zipFile);
  for (const row of rows) {
    assert(row.source_batch === batchKey, 'Mixed source batches');
    const key = String(row.copy_id ?? '');
    assert(key && !seen.has(key), 'Missing or repeated physical-copy ID');
    seen.add(key);
    for (const side of ['front', 'back']) {
      const name = safeName(row.images?.[side + '_archive_path']);
      assert(zip.file(name) && !zip.file(name).dir, 'Image absent from ZIP: ' + name);
    }
  }
  // Same source batch is resumed, never inserted a second time.
  const existing = unwrap(await supabase.from('gv_collection_batches').select('id')
    .eq('user_id', userId).eq('source', 'card_dealer_pro')
    .eq('external_batch_id', batchKey).limit(2), 'Find batch');
  assert(existing.length <= 1, 'Duplicate batch records require manual repair');
  let batchId = existing[0]?.id;
  if (!batchId) {
    const created = unwrap(await supabase.from('gv_collection_batches').insert({
      user_id: userId, source: 'card_dealer_pro', external_batch_id: batchKey
    }).select('id').single(), 'Create batch');
    batchId = created.id;
  }
  let completed = 0;
  for (const row of rows) {
    const sourceKey = String(row.copy_id);
    let copies = unwrap(await supabase.from('gv_collection_copies').select('id')
      .eq('user_id', userId).eq('batch_id', batchId)
      .eq('source_row_key', sourceKey).limit(2), 'Find physical copy');
    assert(copies.length <= 1, 'Duplicate copy records require manual repair');
    let copyId = copies[0]?.id;
    if (!copyId) {
      const copy = unwrap(await supabase.from('gv_collection_copies').insert({
        user_id: userId, batch_id: batchId, source_row_key: sourceKey,
        raw_identification: { source: 'card_dealer_pro', source_sku: row.source_sku ?? null,
          cdp_fields: row.cdp_fields ?? {}, card_identity_key: row.card_identity_key ?? null,
          identification_status: row.identification_status ?? 'unverified' },
        review_status: row.review_required ? 'needs_review' : 'pending',
        serial_stamp: row.cdp_fields?.serial_stamp || null
      }).select('id').single(), 'Create physical copy');
      copyId = copy.id;
    }
    const existingImages = unwrap(await supabase.from('gv_collection_copy_images')
      .select('side,storage_path').eq('user_id',userId).eq('copy_id',copyId), 'Find images');
    for (const side of ['front','back']) {
      const name = safeName(row.images[side + '_archive_path']);
      const objectPath = userId + '/' + batchKey + '/' + sourceKey + '/' + side + '.jpg';
      const prior = existingImages.filter(image => image.side === side);
      assert(prior.length <= 1, 'Duplicate image records require manual repair');
      if (prior.length) {
        assert(prior[0].storage_path === objectPath, 'Existing image path differs; manual review required');
        continue;
      }
      const bytes = await zip.file(name).async('uint8array');
      assert(bytes.length > 0 && bytes.length <= 10 * 1024 * 1024, 'Invalid image size: ' + name);
      const uploaded = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
        contentType: 'image/jpeg', upsert: false
      });
      // A previously interrupted run may have uploaded an object before its DB row.
      if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message))
        throw new Error('Upload ' + name + ': ' + uploaded.error.message);
      unwrap(await supabase.from('gv_collection_copy_images').insert({
        user_id: userId, copy_id: copyId, side, storage_path: objectPath
      }), 'Record image');
    }
    completed++;
    onProgress({ completed, total: rows.length, copy_id: sourceKey });
  }
  return { status: 'imported_or_resumed', batch_id: batchId, physical_copies_processed: completed,
    expected_images: rows.length * 2, production_modified: false };
}
