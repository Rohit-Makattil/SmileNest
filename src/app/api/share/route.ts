import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function decodeBase64Image(dataUrl: string) {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 string');
  }
  return {
    contentType: matches[1],
    buffer: Buffer.from(matches[2], 'base64')
  };
}

const generateFileName = (ext: string) => {
  const rand = Math.random().toString(36).substring(2, 11);
  return `${rand}-${Date.now()}.${ext}`;
};

function getExtension(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('captures')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Capture not found' }, { status: 404 });
    }
    return NextResponse.json({ capture: data });
  } catch (err: any) {
    console.error('Share GET route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }
    
    switch (action) {
      case 'capture': {
        const { visitorId, sessionId, type, filterUsed, frameUsed, imageUrl, capturedMedia, capturedBoomerang, processingTimeMs } = body;
        
        let finalImageUrl = imageUrl || '';

        // If base64 captured media is supplied, upload it on the server
        if (capturedMedia && capturedMedia.startsWith('data:')) {
          try {
            const { contentType, buffer } = decodeBase64Image(capturedMedia);
            const ext = getExtension(contentType);
            const fileName = `photos/${generateFileName(ext)}`;

            const { error: uploadError } = await supabaseAdmin.storage
              .from('photobooth')
              .upload(fileName, buffer, {
                contentType,
                upsert: true
              });

            if (uploadError) {
              console.error('Server storage upload error (media):', uploadError);
              return NextResponse.json({ error: 'Failed to upload photo strip' }, { status: 500 });
            }

            const { data: pubData } = supabaseAdmin.storage
              .from('photobooth')
              .getPublicUrl(fileName);

            finalImageUrl = pubData.publicUrl;

            // If a boomerang sequence was captured, upload it too
            if (capturedBoomerang && capturedBoomerang.startsWith('data:')) {
              const { contentType: bType, buffer: bBuffer } = decodeBase64Image(capturedBoomerang);
              const bExt = getExtension(bType);
              const bFileName = `boomerangs/${generateFileName(bExt)}`;

              const { error: bUploadError } = await supabaseAdmin.storage
                .from('photobooth')
                .upload(bFileName, bBuffer, {
                  contentType: bType,
                  upsert: true
                });

              if (!bUploadError) {
                const { data: bPubData } = supabaseAdmin.storage
                  .from('photobooth')
                  .getPublicUrl(bFileName);
                
                finalImageUrl = `${finalImageUrl}|${bPubData.publicUrl}`;
              } else {
                console.error('Server storage upload error (boomerang):', bUploadError);
              }
            }
          } catch (uploadErr: any) {
            console.error('Failed to parse or upload media:', uploadErr);
            return NextResponse.json({ error: 'Failed to process base64 upload' }, { status: 500 });
          }
        }

        if (!type || !filterUsed || !frameUsed || !finalImageUrl) {
          return NextResponse.json({ error: 'Missing capture details' }, { status: 400 });
        }
        
        const { data, error } = await supabaseAdmin
          .from('captures')
          .insert({
            visitor_id: visitorId || null,
            session_id: sessionId || null,
            type,
            filter_used: filterUsed,
            frame_used: frameUsed,
            image_url: finalImageUrl,
            processing_time_ms: processingTimeMs || 0
          })
          .select()
          .single();
          
        if (error) {
          console.error('Database error on capture insert:', error);
          return NextResponse.json({ error: 'Failed to record capture' }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, capture: data });
      }
      
      case 'download': {
        const { captureId, format } = body;
        
        if (!captureId || !format) {
          return NextResponse.json({ error: 'Missing download details' }, { status: 400 });
        }
        
        const { data, error } = await supabaseAdmin
          .from('downloads')
          .insert({
            capture_id: captureId,
            format
          })
          .select()
          .single();
          
        if (error) {
          console.error('Database error on download insert:', error);
          return NextResponse.json({ error: 'Failed to record download' }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, download: data });
      }
      
      case 'qr': {
        const { captureId } = body;
        
        if (!captureId) {
          return NextResponse.json({ error: 'Missing captureId for QR share' }, { status: 400 });
        }
        
        const { data, error } = await supabaseAdmin
          .from('qr_shares')
          .insert({
            capture_id: captureId
          })
          .select()
          .single();
          
        if (error) {
          console.error('Database error on QR share insert:', error);
          return NextResponse.json({ error: 'Failed to record QR share' }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, qr_share: data });
      }
      
      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Share action handler error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
