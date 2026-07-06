const ts=require("typescript"),fs=require("fs");
const files=[["components/funnel/templates/skins/factory.tsx",ts.ScriptKind.TSX],["components/funnel/FunnelPreview.tsx",ts.ScriptKind.TSX],["components/editor/GlobalStylePanel.tsx",ts.ScriptKind.TSX]];
for(const [f,kind] of files){
  const src=fs.readFileSync(f,"utf8");const total=src.split("\n").length;
  const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,kind);
  const d=sf.parseDiagnostics||[];
  if(d.length){const p=sf.getLineAndCharacterOfPosition(d[0].start);console.log("ERR "+f+" @L"+(p.line+1)+"/"+total+" "+ts.flattenDiagnosticMessageText(d[0].messageText,"\n"));}
  else console.log("OK "+f+" ("+total+"L)");
}
