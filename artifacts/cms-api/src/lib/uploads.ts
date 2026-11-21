import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpError } from './http.ts';

let activeUploads = 0;
// Admission control is per process; enforce aggregate ingress limits at the
// reverse proxy too. Do not queue arbitrary uploads in application memory.
export function uploadAdmission(_req: Request, res: Response, next: NextFunction) {
  if (activeUploads >= 2) return next(new HttpError(429, 'The upload service is busy. Try again shortly.', 'rate_limited'));
  activeUploads++;
  let released = false;
  const release = () => { if (!released) { released = true; activeUploads--; } };
  res.once('finish', release); res.once('close', release);
  next();
}

export function boundedUpload(totalBytes: number, fileBytes = totalBytes) {
  const totals = new WeakMap<Request, number>();
  const storage: multer.StorageEngine = {
    _handleFile(req, file, done) {
      const chunks: Buffer[] = [];
      let size = 0;
      const sink = new Writable({ write(chunk: Buffer, _encoding, callback) {
        const total = (totals.get(req) ?? 0) + chunk.length;
        totals.set(req, total);
        if (total > totalBytes) return callback(new HttpError(413, 'The combined upload is too large.', 'upload_size'));
        size += chunk.length; chunks.push(chunk); callback();
      } });
      void pipeline(file.stream, sink).then(() => done(null, { buffer: Buffer.concat(chunks, size), size }), (error: Error) => done(error));
    },
    _removeFile(_req, file, done) { delete (file as Partial<Express.Multer.File>).buffer; done(null); },
  };
  return multer({ storage, limits: { fileSize: fileBytes, files: 20, fields: 10, fieldSize: 65536, parts: 30, fieldNameSize: 100 } });
}
