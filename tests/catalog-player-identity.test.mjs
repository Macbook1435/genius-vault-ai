import test from 'node:test';
import assert from 'node:assert/strict';
import {pickCatalogCard} from '../api/cardsight.js';
const c=(name,releaseYear=2025)=>({id:'id1',name,number:'340',releaseYear,releaseName:'2025 Donruss Football',setName:'Optic Rated Rookies Preview',attributes:[]});
const input={player:'Mason Graham',number:'340',year:2025,set:'Donruss Football Optic Rated Rookies Preview',brand:'Panini'};
test('same surname but different first name is rejected',()=>{
 assert.equal(pickCatalogCard([c('Andrew Graham')],input).status,'no_match');
});
test('same surname and number with exact name is accepted',()=>{
 assert.equal(pickCatalogCard([c('Mason Graham')],input).status,'matched');
});
test('year prefix like 20250 cannot pass as 2025',()=>{
 assert.equal(pickCatalogCard([c('Mason Graham',20250)],input).status,'no_match');
});
