
const fs=require("fs"), ts=require("typescript");
let count=0, errors=[];
for(const file of process.argv.slice(2)){
  const code=fs.readFileSync(file,"utf8");
  const source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  count++;
  for(const d of source.parseDiagnostics||[])errors.push({file,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});
}
console.log(JSON.stringify({parsed:count,errors}));
process.exit(errors.length?1:0);
