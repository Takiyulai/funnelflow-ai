const ts=require("typescript"),fs=require("fs");
const f="hooks/useFunnelAnimations.ts";
const src=fs.readFileSync(f,"utf8");const total=src.split("\n").length;
const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const d=sf.parseDiagnostics||[];
if(d.length){const p=sf.getLineAndCharacterOfPosition(d[0].start);console.log("ERR @L"+(p.line+1)+"/"+total+" "+ts.flattenDiagnosticMessageText(d[0].messageText,"\n"));}
else console.log("OK ("+total+"L)");
