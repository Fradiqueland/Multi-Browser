import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,realpathSync,rmdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {nativeLaunchDirectory} from '../src/native-path.mjs';
test('Caminho nativo curto e estavel conserva os dados na pasta portatil',()=>{
 const root=mkdtempSync(join(tmpdir(),'mb-native-path-')),directory=join(root,'Perfil com espaços e acentuação', 'nested'.repeat(12));mkdirSync(directory,{recursive:true});
 const launch=nativeLaunchDirectory(directory);assert.equal(nativeLaunchDirectory(directory),launch);assert.equal(realpathSync(launch),realpathSync(directory));writeFileSync(join(launch,'marker'),'portable-data');assert.equal(readFileSync(join(directory,'marker'),'utf8'),'portable-data');
 const other=join(root,'other');mkdirSync(other);assert.notEqual(nativeLaunchDirectory(other),launch);
});
test('Ligacao de perfil adulterada e recusada sem modificar o destino',{skip:process.platform!=='win32'},()=>{
 const root=mkdtempSync(join(tmpdir(),'mb-native-path-')),directory=join(root,'profile'),other=join(root,'other');mkdirSync(directory);mkdirSync(other);writeFileSync(join(other,'marker'),'preserved');const alias=nativeLaunchDirectory(directory);
 rmdirSync(alias);symlinkSync(other,alias,'junction');assert.throws(()=>nativeLaunchDirectory(directory),/autorizada/);assert.equal(readFileSync(join(other,'marker'),'utf8'),'preserved');rmdirSync(alias);
 mkdirSync(alias);assert.throws(()=>nativeLaunchDirectory(directory),/autorizada/);rmdirSync(alias);
});
