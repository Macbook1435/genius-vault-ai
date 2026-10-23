// Generic CSV checklist adapter. Explicit column mapping is mandatory.
// Pure parser: no database calls, no automatic header guessing.
const CANONICAL = new Set(['manufacturer','release_year','product_name','set_name','card_number','player_name','team_name','position','sport','league','license_status','is_rookie','is_autograph','is_memorabilia','card_type','parallel_name','print_run','print_run_basis','serial_numbered','color_signature','finish_signature']);
function parseCsv(text) {
  if (typeof text !== 'string') throw new TypeError('CSV must be text');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (quoted) {
      if (c==='"' && text[i+1]==='"') {cell+='"';i++;}
      else if(c==='"') {quoted=false;closed=true;}
      else cell+=c;
    } else if(c==='"' && !cell && !closed) quoted=true;
    else if(c===',') {row.push(cell);cell='';closed=false;}
    else if(c==='\n' || c==='\r') {
      if(c==='\r' && text[i+1]==='\n')i++;
      row.push(cell);rows.push(row);row=[];cell='';closed=false;
    } else {
      if (closed && c!==' ' && c!=='\t') throw new Error('Unexpected characters after quoted field');
      cell+=c;
    }
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  if(row.length || cell || closed){row.push(cell);rows.push(row);}
  return rows;
}
export const csvGenericAdapter = {
  name:'csv-generic',
  version:'1.0.0',
  sourceType:'authorized_csv',
  detect(file) {return typeof file==='string';},
  parse(file, {columnMapping}={}) {
    if (!columnMapping || typeof columnMapping!=='object' || Array.isArray(columnMapping) || !Object.keys(columnMapping).length) throw new Error('Explicit columnMapping is required');
    for(const [target,source] of Object.entries(columnMapping)) {
      if(!CANONICAL.has(target) || typeof source!=='string' || !source.trim())throw new Error('Invalid mapping for '+target);
    }
    const data=parseCsv(file);
    if(!data.length)return {records:[],parseErrors:[{code:'EMPTY_CSV'}]};
    const headers=data[0], unique=new Set(headers);
    if(unique.size!==headers.length)throw new Error('Duplicate CSV headers');
    for(const source of Object.values(columnMapping))if(!unique.has(source))throw new Error('Missing mapped header: '+source);
    const records=[],parseErrors=[];
    for(let i=1;i<data.length;i++) {
      const cells=data[i];
      if(cells.length===1 && !cells[0].trim())continue;
      if(cells.length!==headers.length){parseErrors.push({sourceRowNumber:i+1,code:'COLUMN_COUNT_MISMATCH'});continue;}
      const original=Object.fromEntries(headers.map((h,j)=>[h,cells[j]]));
      const fields=Object.fromEntries(Object.entries(columnMapping).map(([target,source])=>[target,original[source]]));
      const unmappedColumns=headers.filter(h=>!Object.values(columnMapping).includes(h));
      records.push({sourceRowNumber:i+1,fields,raw_record:original,unmappedColumns});
    }
    return {records,parseErrors};
  }
};
