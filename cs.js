// カメラ映像と背景を canvas にレンダリング
const updateCompositeImage = () => {
  //console.log('updating composite image')
  const { compositeMaskedBackgroundImageData: bg, video, canvas, canvasCtx } = GMCI;
  canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, canvas.width, canvas.height);
  if(bg) canvasCtx.drawImage(bg,    0, 0, bg.width,          bg.height,        0, 0, canvas.width, canvas.height);
  canvasCtx.font = '48px serif';
  canvasCtx.fillStyle = 'red';
  canvasCtx.fillText('Hello Canvas!', 10, 50);
  requestAnimationFrame(updateCompositeImage);
};


// マスク済み背景を作成
const updateMaskImage = () => {
  if(!GMCI.bodyPixNet) return false;
  GMCI.bodyPixNet.segmentPerson(GMCI.video).then(segmentation => {
    const fgColor = { r: 0, g: 0, b: 0, a: 0 }; // 人体部分は透明
    const bgColor = { r: 0, g: 0, b: 0, a: 255 };　// 周囲は不透明
    const maskImageData = bodyPix.toMask(segmentation, fgColor, bgColor);
    const maskpx = maskImageData.data;
    const bgpx = GMCI.composeBackgroundImageData.data;
    for(let i=0; i<maskpx.length; i+=4) bgpx[i+3] = maskpx[i+3]; // マスクの透明度を背景に適用
    GMCI.compositeMaskedBackgroundImageData = new ImageData(bgpx);
    //if (contineuAnimation) {
    GMCI.maskImageTimerId = setTimeout(updateMaskImage, 10); // 次の人体セグメンテーションの実行を予約する
    //}
  }).catch(err => {
    console.error('segmentPerson ERROR:', err);
  });
};


// 設定 UI を構築
const buildSettingUI = node => {
  console.log('Setting UI Build');
  try {
    const control_html =
      `<div id="gmci-control">
         <div class="YUgdob">背景合成（by Meet Camera）</div>
         <div>
           <table><tr>
             <td>
               <label class="matter-switch">
                 <input type="checkbox" id="gmci-composite-enabled" role="switch"${GMCI.composeEnabled ? ' checked' : ''}>
                 <span>合成を有効にする</span>
               </label>
             </td>
           </tr><tr>
             <td>
               <button class="matter-button-outlined" id="gmci-composite-file-button">背景画像を選択</button>
               <input type="file" accept="image/*" id="gmci-composite-file" hidden>
             </td>
           </tr></table>
         </div>
       </div>`;
    node.insertAdjacentHTML('beforeend', control_html);
    const startCapture = () => {
      const vfile = document.getElementById('vfile')
      const file = (vfile.files && vfile.files.length) ? vfile.files[0] : null
      const url = file !== null ? window.URL.createObjectURL(file) : null
      // 合成用ファイル変更時の処理 (合成し直し)
    }
    node.querySelector('#gmci-composite-file-button').addEventListener('click', e => {
      e.target.nextElementSibling.click();
    });
    node.querySelector('#gmci-composite-file').addEventListener('change', e => {
      if(!e.target.files || !e.target.files.length) return;
      const file = e.target.files[0];
      e.target.value = '';
      // 画像ファイルを ImageData オブジェクトに変換
      try {
        const reader = new FileReader();
        reader.onload = e => {
          const buffer = e.result;
          const u8clumpedArray = new Uint8ClampedArray(buffer);
          GMCI.composeBackgroundImageData = new ImageData(u8clumpedArray);
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    });
    node.querySelector('#gmci-composite-enabled').addEventListener('change', e => {
      const enabled = GMCI.composeEnabled = e.target.checked;
      // Meet へ流し込む video track を切り替える
      if(enabled && GMCI.file) {}
      else {}
    });
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};




const init = () => {
  console.log('init')
  console.log('already inited: ', navigator.mediaDevices._getUserMedia !== undefined);
  if(navigator.mediaDevices._getUserMedia !== undefined) return;
  
  const GMCI = window.GMCI = {};
  const video = GMCI.video = document.createElement('video');
    video.muted = true;
    video.loop = false;
    video.onloadedmetadata = () => video.play();
 const canvas = GMCI.canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const canvasCtx = GMCI.canvasCtx = canvas.getContext('2d');
  const canvasVideoTrack = GMCI.canvasVideoTrack = canvas.captureStream(30).getVideoTracks()[0];
  GMCI.bodyPixNet = (async () => { await bodyPix.load() })();
  GMCI.composeEnabled = true;
  
  console.log('GMCI object created')

  // getUserMedia を差し替え
  navigator.mediaDevices._getUserMedia = MediaDevices.prototype._getUserMedia = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia =MediaDevices.prototype.getUserMedia = function(constraints) {
    console.log(constraints)
    return new Promise((resolve, reject) => {
      navigator.mediaDevices._getUserMedia(constraints).then(stream => {
        let newStream;
        const isDesktopVideo = constraints?.video?.mandatory?.chromeMediaSource === 'desktop';
        if (constraints.video && !isDesktopVideo) {
          const video_tracks = stream.getVideoTracks();
          video_tracks.find(track => {
            if (!/^(?:window|screen):[\d]+:[\d]$/.test(track.label)) {
              console.log(track);
              // canvas のソースを切り替え
              GMCI.video.srcObject = new MediaStream([track]);
              // stream の video track のみ差し替え
              //stream.removeTrack(video_tracks[0]); // TODO: すべての video track を削除すべき. 一意に定めたい.
              newStream = new MediaStream([ GMCI.canvasVideoTrack, ...stream.getTracks() ])
              //stream.addTrack(GMCI.canvasVideoTrack);
              return true;
            }
          });
        }
        resolve(newStream || stream);
      }).catch(err => {
        console.error('Error on Original getUserMedia')
        reject(err);
      });
    });
  }.bind(navigator.mediaDevices);

  console.log('getUserMedia override complete')

  // 設定 UI の構築を待機
  try {
    const target = document.querySelector('div#yDmH0d');
    const observer = new MutationObserver(records => {
      console.log('observed');
      records.find(record => {
        return Array.from(record.addedNodes).find(node => {
          if (node.tagName === 'DIV' && node.className === 'llhEMd iWO5td') {
            //observer.disconnect();
            buildSettingUI(node.querySelectorAll('div.fe4pJf[jsname=KYYiw] > span')[1]) // 設定 POPUP 内 動画タブ コンテンツ部分の span 要素を引数に渡す.
            return true;
          }
        });
      });
    });
    observer.observe(target, {
      childList: true,
      subtree: true
    });
  } catch (err) {
    console.error(err);
    alert(err.message);
  }

  console.log('UI observer started')


  // canvas への描画を開始
  updateCompositeImage();

  console.log('rendering started')

};



init();
