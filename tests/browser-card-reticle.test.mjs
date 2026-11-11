import test from 'node:test';
import assert from 'node:assert/strict';
import {reticleDimensions,photoGuidance} from '../lib/browser-card-reticle.mjs';
test('standard portrait guide has 2.5:3.5 ratio',()=>{const x=reticleDimensions(400);assert.ok(Math.abs(x.height/x.width-1.4)<.01)});
test('open booklet guide has 5:3.5 ratio',()=>{const x=reticleDimensions(400,true);assert.ok(Math.abs(x.height/x.width-.7)<.01)});
test('never claims real-time quality measurement',()=>{const x=photoGuidance();assert.equal(x.qualityVerified,false);assert.equal(x.autoCaptureEnabled,false)});
test('back guidance prioritizes card number',()=>assert.match(photoGuidance({side:'back'}).instructions,/card number/));
