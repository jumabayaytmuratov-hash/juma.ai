import JSZip from 'jszip';
import { getCfg, getLic, putLic, leftOf, premium, okDev, json } from '../lib/common.mjs';

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (t) => '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
const imgP = (k) => '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5400000" cy="3600000"/><wp:docPr id="' + k + '" name="Rasm' + k + '"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + k + '" name="r' + k + '.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg' + k + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5400000" cy="3600000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';

async function buildDocx(text, images) {
  const bd = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((x) => '<w:' + x + ' w:val="single" w:sz="4" w:color="000000"/>').join('') + '</w:tblBorders>';
  const L = text.split('\n'); let body = ''; const media = [];
  for (let i = 0; i < L.length;) {
    const mm = L[i].trim().match(/^\[RASM\s*(\d)\s*:?\s*([^\]]*)\]$/);
    if (mm) {
      const n = +mm[1], png = images[n];
      if (png) { media.push([n, png]); body += imgP(n); }
      body += '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>' + run('Rasm ' + n + (mm[2] ? ': ' + mm[2].trim() : '')) + '</w:p>';
      i++; continue;
    }
    if (L[i].split(' | ').length >= 3) {
      const n = L[i].split(' | ').length; let rows = '';
      while (i < L.length && L[i].split(' | ').length >= 3) { rows += '<w:tr>' + L[i].split(' | ').map((c) => '<w:tc><w:p>' + run(c.trim()) + '</w:p></w:tc>').join('') + '</w:tr>'; i++; }
      body += '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>' + bd + '</w:tblPr><w:tblGrid>' + ('<w:gridCol w:w="' + Math.floor(9900 / n) + '"/>').repeat(n) + '</w:tblGrid>' + rows + '</w:tbl><w:p/>';
    } else { body += '<w:p>' + run(L[i]) + '</w:p>'; i++; }
  }
  const z = new JSZip(), H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  z.file('[Content_Types].xml', H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels', H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/document.xml', H + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>');
  z.file('word/_rels/document.xml.rels', H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + media.map(([k]) => '<Relationship Id="rIdImg' + k + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img' + k + '.png"/>').join('') + '</Relationships>');
  media.forEach(([k, b]) => z.file('word/media/img' + k + '.png', b, { base64: true }));
  return z.generateAsync({ type: 'nodebuffer' });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (!okDev(b.d) || typeof b.text !== 'string' || !b.text || b.text.length > 60000) return json({ error: 'bad' }, 400);
  const [c, l] = await Promise.all([getCfg(), getLic(b.d)]);
  const prem = premium(l);
  if (!prem && leftOf(l, c) <= 0) return json({ error: 'pay' }, 402);
  const images = {};
  for (const [k, v] of Object.entries(b.images || {})) {
    const m = String(v).match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (m && /^[1-3]$/.test(k)) images[+k] = m[1];
  }
  const buf = await buildDocx(b.text, images);
  if (!prem) { l.used += 1; await putLic(b.d, l); }
  return new Response(buf, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': 'attachment; filename="dars-ishlanma.docx"', 'cache-control': 'no-store' } });
};
export const config = { path: '/api/download' };
