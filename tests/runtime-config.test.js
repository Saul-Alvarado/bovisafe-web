import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/config.js'
function call(){let code=200,body,headers={};const res={status(v){code=v;return this},json(v){body=v;return this},setHeader(k,v){headers[k]=v}};handler({},res);return{code,body,headers}}
test('Vercel runtime URL changes through environment without editing source',()=>{
 const saved=process.env.BOVISAFE_API_URL,savedFallback=process.env.VITE_API_URL
 try{
  process.env.BOVISAFE_API_URL='https://first.example.invalid/api';assert.equal(call().body.apiUrl,'https://first.example.invalid/api')
  process.env.BOVISAFE_API_URL='https://second.example.invalid/api/';assert.equal(call().body.apiUrl,'https://second.example.invalid/api');assert.equal(call().headers['Cache-Control'],'no-store')
  process.env.BOVISAFE_API_URL='http://insecure.invalid/api';assert.equal(call().code,503)
  delete process.env.BOVISAFE_API_URL;delete process.env.VITE_API_URL;assert.equal(call().code,503)
 }finally{if(saved===undefined)delete process.env.BOVISAFE_API_URL;else process.env.BOVISAFE_API_URL=saved;if(savedFallback===undefined)delete process.env.VITE_API_URL;else process.env.VITE_API_URL=savedFallback}
})
