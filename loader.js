const load = async file => {
  const res = await fetch(file.type === 'chrome' ? chrome.runtime.getURL(file.path) : file.path, { method: 'GET' });
  const js = await res.text();
  const script = document.createElement('script');
  script.textContent = js;
  document.body.appendChild(script);
}

window.addEventListener('load', async e => {
  await load({   
    path: 'script/tfjs@1.2.js',
    type: 'chrome'
  })
  await load({
    path: 'script/body-pix@2.0.js',
    type: 'chrome'
  })
  await load({
    path: 'cs.js',
    type: 'chrome'
  })
});
