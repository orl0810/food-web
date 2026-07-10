import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface BarcodeScanResult { rawValue:string; format:string; }
export interface BarcodeScannerPort { start(target:HTMLVideoElement):Promise<void>; stop():Promise<void>; scanResults():Observable<BarcodeScanResult>; isSupported():boolean; }
interface DetectorResult { rawValue:string; format:string; }
interface Detector { detect(source:ImageBitmapSource):Promise<DetectorResult[]>; }
interface DetectorConstructor { new(options:{formats:string[]}):Detector; }

@Injectable({providedIn:'root'})
export class BrowserBarcodeScannerService implements BarcodeScannerPort {
  private readonly results=new Subject<BarcodeScanResult>(); private stream:MediaStream|null=null; private timer:number|null=null; private processing=false; private last='';
  isSupported():boolean { return typeof navigator!=='undefined'&&!!navigator.mediaDevices?.getUserMedia&&'BarcodeDetector' in globalThis; }
  scanResults():Observable<BarcodeScanResult>{return this.results.asObservable();}
  async start(video:HTMLVideoElement):Promise<void>{
    await this.stop(); if(!this.isSupported()) throw new Error('Barcode scanning is not supported on this browser. Use manual entry instead.');
    this.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}); video.srcObject=this.stream; await video.play();
    const Ctor=(globalThis as unknown as {BarcodeDetector:DetectorConstructor}).BarcodeDetector; const detector=new Ctor({formats:['ean_13','ean_8','upc_a','upc_e']});
    this.timer=window.setInterval(async()=>{if(this.processing||video.readyState<2)return;this.processing=true;try{const [hit]=await detector.detect(video);if(hit&&hit.rawValue!==this.last){this.last=hit.rawValue;this.results.next(hit);await this.stop();}}finally{this.processing=false;}},250);
  }
  async stop():Promise<void>{if(this.timer!==null){clearInterval(this.timer);this.timer=null;}this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;}
}
