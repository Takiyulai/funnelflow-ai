const ts=require("typescript"),fs=require("fs");
const f="components/funnel/templates/skins/factory.tsx";
const src=fs.readFileSync(f,"utf8");
const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const d=sf.parseDiagnostics||[];
const total=src.split("\n").length;
if(d.length){d.slice(0,5).forEach(x=>{const p=sf.getLineAndCharacterOfPosition(x.start);console.log("ERR L"+(p.line+1)+"/"+total+" "+ts.flattenDiagnosticMessageText(x.messageText,"\n"));});}
else console.log("OK "+total+" lines");
