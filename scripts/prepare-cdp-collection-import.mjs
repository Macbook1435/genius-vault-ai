// CDP manifest normalization for the test importer. No network calls or writes.
export function prepareCdpManifest(manifest) {
  if (!manifest || manifest.schema !== 'genius-vault-cdp-import-v1' || !Array.isArray(manifest.records)) {
    throw new Error('Unsupported CDP manifest');
  }
  const batchId = String(manifest.source_batch || '').trim();
  if (!batchId) throw new Error('Missing source batch');
  const seen = new Set();
  const copies = manifest.records.map((record, index) => {
    const rowKey = String(record.copy_id || '').trim();
    if (!rowKey || seen.has(rowKey)) throw new Error('Missing or repeated physical-copy key at row ' + (index + 1));
    seen.add(rowKey);
    const fields = record.cdp_fields || {};
    const images = record.images || {};
    if (!images.front_archive_path || !images.back_archive_path) throw new Error('Missing image at row ' + (index + 1));
    return {
      source_row_key: rowKey,
      raw_identification: {
        source: 'card_dealer_pro',
        verification: 'unverified',
        source_sku: record.source_sku ?? null,
        title: fields.title ?? null,
        player: fields.player ?? null,
        year: fields.year ?? null,
        brand: fields.brand ?? null,
        set: fields.set ?? null,
        subset: fields.subset ?? null,
        card_number: fields.card_number ?? null,
        variation: fields.variation ?? null,
        attributes: fields.attributes ?? null,
        team: fields.team ?? null,
        sale_price: fields.sale_price ?? null,
        market_price: fields.market_price ?? null,
        source_row: record.source_row ?? index + 1
      },
      review_status: 'needs_review',
      images: {
        front: images.front_archive_path,
        back: images.back_archive_path
      }
    };
  });
  return { source: 'card_dealer_pro', external_batch_id: batchId, copies };
}
