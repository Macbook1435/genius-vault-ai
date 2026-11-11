import importlib.util, json, tempfile, unittest, zipfile, csv, hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location('batch',Path(__file__).parents[1]/'scripts/prepare-accuracy-batch.py')
batch=importlib.util.module_from_spec(spec);spec.loader.exec_module(batch)
class BatchPreparation(unittest.TestCase):
 def test_exact_pairing_hash_checks_and_unverified_source_labels(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);archive=root/'cards.zip';manifest=root/'manifest.csv';output=root/'result.json'
   data=b'\xff\xd8\xffsynthetic-offline-test';digest=hashlib.sha256(data).hexdigest();rows=[]
   with zipfile.ZipFile(archive,'w') as z:
    for i in range(110):
     id=str(100000+i);r={'original_image_id':id,'csv_row':i+1,'imported_player_unverified':'Unverified source'}
     for side in ['front','back']:
      name=f'{id}-{side}.jpg';z.writestr(name,data);r[f'{side}_filename']=name;r[f'{side}_sha256']=digest
     rows.append(r)
   def write():
    with manifest.open('w') as f:
     w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
   write();result=batch.prepare(archive,manifest,output)
   self.assertEqual(result['pair_count'],110);self.assertEqual(result['cost_ceiling_usd'],0)
   self.assertTrue(all(r['ground_truth'] is None and not r['approval_allowed'] for r in result['pairs']))
   rows[0]['front_sha256']='0'*64;write()
   with self.assertRaisesRegex(ValueError,'hash'):batch.prepare(archive,manifest,output)
   rows[0]['front_sha256']=digest;rows[1]['original_image_id']=rows[0]['original_image_id'];write()
   with self.assertRaisesRegex(ValueError,'duplicate'):batch.prepare(archive,manifest,output)
if __name__=='__main__':unittest.main()
