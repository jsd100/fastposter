import {describe,it,expect} from 'vitest';
import valid from '../../../tests/fixtures/documents/valid-mixed.json';
import overflow from '../../../tests/fixtures/documents/overflow-width.json';
import unknown from '../../../tests/fixtures/documents/unknown-mark.json';
import {parseDocument,migrateDocument} from './index';
describe('versioned document boundary',()=>{
 it('preserves mixed inline marks on round trip',()=>expect(parseDocument(JSON.parse(JSON.stringify(valid)))).toEqual(valid));
 it.each([overflow,unknown])('rejects geometry or unknown marks',value=>expect(()=>parseDocument(value)).toThrow());
 it('rejects 101 blocks',()=>expect(()=>parseDocument({...valid,textBlocks:Array.from({length:101},(_,i)=>({...valid.textBlocks[0],id:`b${i}`}))})).toThrow());
 it('rejects 10001 characters',()=>{const d=structuredClone(valid);d.textBlocks[0].content.content[0].content[0].text='a'.repeat(10001);expect(()=>parseDocument(d)).toThrow()});
 it('enforces area and side independently',()=>{expect(()=>parseDocument({...valid,canvas:{width:8192,height:4800}})).not.toThrow();for(const canvas of [{width:8193,height:100},{width:8192,height:8192}])expect(()=>parseDocument({...valid,canvas})).toThrow()});
 it('rejects unknown versions, dangling font ids and oversized data',()=>{expect(()=>migrateDocument({...valid,schemaVersion:2})).toThrow();const d=structuredClone(valid);d.textBlocks[0].defaultStyle.fontId='missing';expect(()=>parseDocument(d)).toThrow();expect(()=>parseDocument({...valid,extra:'x'.repeat(2*1024*1024)})).toThrow()});
});
