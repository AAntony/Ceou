import * as Print from 'expo-print';
import qrFactory from 'qrcode-generator';
import { movingQr, type MovingBox } from './model';
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export async function printMovingLabels(boxes:MovingBox[]) {
 const labels=boxes.map(box=>{const qr=qrFactory(0,'M');qr.addData(movingQr(box.id));qr.make();return `<article>${qr.createImgTag(5,20)}<h2>${escapeHtml(box.name)}</h2><p>${escapeHtml(box.destination_name??'')}</p></article>`;}).join('');
 await Print.printAsync({html:`<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:12mm}body{font-family:Arial;display:flex;flex-wrap:wrap}article{box-sizing:border-box;width:50%;min-height:90mm;padding:8mm;border:1px dashed #999;text-align:center;break-inside:avoid}img{max-width:100%;width:48mm;height:auto}h2{font-size:18px}p{font-size:18px}</style></head><body>${labels}</body></html>`});
}
