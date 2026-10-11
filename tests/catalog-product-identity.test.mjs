import test from 'node:test';
import assert from 'node:assert/strict';
import {pickCatalogCard} from '../api/cardsight.js';
const input={player:'Mason Graham',number:'340',year:2025,set:'Donruss Football Optic Rated Rookies Preview',brand:'Panini'};
const record=(releaseName,setName='Rated Rookies')=>({id:'item1',name:'Mason Graham',number:'340',releaseYear:2025,releaseName,setName,attributes:[]});
test('unique wrong product candidate does not override card scan',()=>{
 const result=pickCatalogCard([record('2025 Donruss Optic Football')],input);
 assert.equal(result.status,'no_match');
});
test('correct Donruss Football Optic Preview release matches',()=>{
 const result=pickCatalogCard([record('2025 Donruss Football','Optic Rated Rookies Preview')],input);
 assert.equal(result.status,'matched');
});
test('wrong catalog subset is blocked even with same number and player',()=>{
 const result=pickCatalogCard([record('2025 Donruss Football','Rated Rookies')],input);
 assert.equal(result.status,'no_match');
});
test('no guessed set still allows unique candidate but is not subset verification',()=>{
 const result=pickCatalogCard([record('2025 Donruss Football')],{player:'Mason Graham',number:'340',year:2025});
 assert.equal(result.status,'matched');
});
