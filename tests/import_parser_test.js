const need=(n)=>require(require.resolve(n,{paths:[process.cwd(),__dirname,'/tmp/node_modules']}));
const {JSDOM}=need('jsdom');
global.window=global;
global.DOMParser=new JSDOM('').window.DOMParser;
const m=need('mammoth');
global.mammoth={convertToHtml:o=>m.convertToHtml({buffer:Buffer.from(o.arrayBuffer)}),extractRawText:o=>m.extractRawText({buffer:Buffer.from(o.arrayBuffer)})};
global.XLSX=need('xlsx');
const fs=require('fs');
global.TF_CONFIG={MAX_UPLOAD_MB:10,MAX_QUESTIONS:2000};
eval(fs.readFileSync(require('path').join(__dirname,'..','assets','js','import-parser.js'),'utf8')+';global.IP=ImportParser;');
function F(name,buf){const b=Buffer.from(buf);return {name,size:b.length,slice:(s,e)=>({arrayBuffer:async()=>b.buffer.slice(b.byteOffset+s,b.byteOffset+Math.min(e??b.length,b.length))}),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};}
let pass=0,fail=0;const ok=(n,c,i='')=>{c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+n+' '+(c?'':i));};
(async()=>{
 const docxPath=process.argv[2];
 if(docxPath&&fs.existsSync(docxPath)){const docx=fs.readFileSync(docxPath);
 let r=await IP.readFile(F('t.docx',docx));
 ok('docx table detected',r.sources.length>=1&&r.sources[0].cols===5);
 let map=IP.guessMapping(r.sources[0]);ok('no false header on real docx',map.header===false);
 let b=IP.buildQuestions(r.sources,map);ok('docx: all rows valid, 4 options each',b.stats.valid===b.stats.rows&&b.questions.every(q=>q.options.length===4),JSON.stringify(b.stats));}
 const csv=Buffer.from("Savol,To'g'ri javob,Xato 1,Xato 2\n\"Savol, vergul bilan\",A,B,C\n,X,Y,Z\nSavol 2,,B,C\nSavol 3,A,A,A\nSavol, 4 ,  T  ,F\n\nsavol, vergul bilan,Q,W,E\n");
 r=await IP.readFile(F('a.csv',csv));map=IP.guessMapping(r.sources[0]);
 b=IP.buildQuestions(r.sources,map);
 ok('csv header detected',map.header===true);
 ok('csv stats: valid/invalid/dups',b.stats.valid===3&&b.stats.invalid===3&&b.stats.duplicates===1,JSON.stringify(b.stats)+JSON.stringify(b.skipped));
 ok('invalid reasons reported',b.skipped.some(s=>s.reason.includes('savol matni bo‘sh'))&&b.skipped.some(s=>s.reason.includes('to‘g‘ri javob bo‘sh'))&&b.skipped.some(s=>s.reason.includes('xato javoblar yo‘q')));
 ok('ordinary question not mistaken for header',IP.looksLikeHeader(['Savol nima?','Javob'])===false);
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Q1','A','B','C']]),'Birinchi');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Q2','A','B'],['Q3','C','D','E','F']]),'Ikkinchi');
 const xl=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
 r=await IP.readFile(F('x.xlsx',xl));
 ok('xlsx multiple sheets listed',r.sources.length===2&&r.sources[1].label==='Ikkinchi');
 b=IP.buildQuestions([r.sources[1]],IP.guessMapping(r.sources[1]));ok('xlsx variable option counts',b.questions.length===2&&b.questions[0].options.length===2&&b.questions[1].options.length===4);
 const uni=Buffer.from("Savol,Javob,X\n"+"Oʻzbekiston ğ қ ҳ ў ".repeat(40)+",To‘g‘ri,Xato\n");
 r=await IP.readFile(F('u.csv',uni));b=IP.buildQuestions(r.sources,IP.guessMapping(r.sources[0]));ok('long Unicode preserved',b.questions.length===1&&b.questions[0].question.includes('қ ҳ ў'));
 for(const [n,f,code] of [['empty file',F('e.csv',Buffer.alloc(0)),'EMPTY'],['bad extension',F('a.pdf',Buffer.from('x')),'BAD_EXT'],['xlsx that is text',F('f.xlsx',Buffer.from('hello,world')),'BAD_CONTENT'],['csv that is zip',F('f.csv',Buffer.from([0x50,0x4b,3,4,0,0])),'BAD_CONTENT'],['too big',Object.assign(F('big.csv',Buffer.from('a')),{size:11*1048576}),'TOO_BIG']]){
  try{await IP.readFile(f);ok(n,false,'no error');}catch(e){ok(n+' rejected',e.code===code,e.code+' '+e.message);}
 }
 try{await IP.readFile(F('c.docx',Buffer.from([0x50,0x4b,3,4,1,2,3,4,5,6,7])));ok('corrupt docx',false);}catch(e){ok('corrupt docx rejected',e.code==='CORRUPT',e.code);}
 try{await IP.readFile(F('c.xlsx',Buffer.from([0x50,0x4b,3,4,1,2,3,4,5,6,7])));ok('corrupt xlsx',false);}catch(e){ok('corrupt xlsx rejected',['CORRUPT','EMPTY'].includes(e.code),e.code);}
 let many='';for(let i=0;i<2105;i++)many+=`Q${i},A${i},B${i}\n`;
 r=await IP.readFile(F('m.csv',Buffer.from(many)));b=IP.buildQuestions(r.sources,IP.guessMapping(r.sources[0]));ok('more than 2000 questions truncated with warning',b.questions.length===2000&&b.warnings.some(w=>w.includes('2000')));
 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
