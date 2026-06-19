import { readFileSync } from "fs";
import { join } from "path";

export default function DownloadPage() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>ELASTICO - Download Source Code</title>
        <style>{`
          body { margin: 0; background: #0a0a0a; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { background: #111; border: 1px solid #333; border-radius: 16px; padding: 48px; text-align: center; max-width: 500px; }
          h1 { font-size: 28px; margin-bottom: 8px; }
          p { color: #888; margin-bottom: 32px; line-height: 1.5; }
          .size { color: #aaa; font-size: 13px; margin-bottom: 24px; }
          a { display: inline-block; background: #22c55e; color: #000; font-weight: 700; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-size: 16px; }
          a:hover { background: #16a34a; }
          .note { margin-top: 24px; font-size: 12px; color: #555; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>ELASTICO Source Code</h1>
          <p>Complete source code with all bug fixes. Run <code>npm install</code> after extracting.</p>
          <div className="size">536 KB .zip</div>
          <a href="/api/download-source">Download ZIP</a>
          <div className="note">Includes: src/, app/, lib/, public/, configs, Dockerfile</div>
        </div>
      </body>
    </html>
  );
}