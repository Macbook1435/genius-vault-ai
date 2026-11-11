import test from "node:test";
import assert from "node:assert/strict";
import { buildFieldVerification } from "../api/_lib/verification.js";

const card = (overrides={}) => ({year:2025,brand:"Topps",set:"Resurgence",player:"Tyler Shough",cardNumber:"163",parallel:null,serialNumber:null,numberedTo:null,...overrides});
const verification = (overrides={}) => ({outside:{catalog:{status:"unavailable"}},parallelId:{status:"unknown"},...overrides});

test("missing serial cannot be confirmed as unnumbered",()=>{
  const result=buildFieldVerification(card(),verification());
  assert.equal(result.fields.serial.status,"unconfirmed");
  assert.match(result.fields.serial.basis,/no serial number detected/i);
});

test("product checklist alone does not confirm set",()=>{
  const result=buildFieldVerification(card(),verification(),{checklist:{id:"test",year:2025},identity:{setOk:false}});
  assert.equal(result.fields.set.status,"unconfirmed");
});

test("catalog number mismatch cannot confirm card number",()=>{
  const result=buildFieldVerification(card(),verification({outside:{catalog:{status:"accepted",match:{number:"164"}}}}),{identity:{numberOk:true}});
  assert.equal(result.fields.cardNumber.status,"unconfirmed");
});

test("matching catalog number still requires independent number check",()=>{
  const result=buildFieldVerification(card(),verification({outside:{catalog:{status:"accepted",match:{number:"163"}}}}),{identity:{numberOk:false}});
  assert.equal(result.fields.cardNumber.status,"unconfirmed");
});

test("parallel candidate without physical evidence remains unconfirmed",()=>{
  const result=buildFieldVerification(card({parallel:"Blue",numberedTo:250}),verification({parallelId:{status:"confirmed",evidence:{}}}),{checklist:{id:"test"}});
  assert.equal(result.fields.parallel.status,"unconfirmed");
});

test("parallel candidate with conflicting stamped run remains unconfirmed",()=>{
  const result=buildFieldVerification(card({parallel:"Blue",numberedTo:250}),verification({parallelId:{status:"confirmed",evidence:{numberedTo:199,color:"blue"}}}),{checklist:{id:"test"}});
  assert.equal(result.fields.parallel.status,"unconfirmed");
});
