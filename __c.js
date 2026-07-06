const ts=require("typescript"),fs=require("fs");
const f="components/funnel/templates/skins/factory.tsx";
const sf=ts.createSourceFile(f,fs.readFileSync(f,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const d=sf.parseDiagnostics||[];
if(d.length){d.slice(0,6).forEach(x=>{const p=sf.getLineAndCharacterOfPosition(x.start);console.log("ERR L"+(p.line+1)+" "+ts.flattenDiagnosticMessageText(x.messageText,"\n"));});}
else console.log("OK factory.tsx "+fs.readFileSync(f,"utf8").split("\n").length+" lines");
