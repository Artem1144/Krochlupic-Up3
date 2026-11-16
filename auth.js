/* Krochlupic-Up Firebase Authentication bootstrap.
   Keeps legacy profile.id and local save intact; UID is stored separately.
   Do not treat client-side account metadata as a trusted game score. */
(function(){
  "use strict";
  var gate=document.getElementById("account-gate");
  if(!gate)return;
  var email=document.getElementById("account-email");
  var password=document.getElementById("account-password");
  var status=document.getElementById("account-status");
  var login=document.getElementById("account-login");
  var register=document.getElementById("account-register");
  var logout=document.getElementById("account-logout");
  var auth=null, busy=false;
  function say(message,isError){status.textContent=message;status.style.color=isError?"#ff8585":"#ffd27a";}
  function setBusy(value){busy=value;login.disabled=value;register.disabled=value;}
  function credentials(){
    var e=(email.value||"").trim(); var p=password.value||"";
    if(!e||!/^\S+@\S+\.\S+$/.test(e))throw new Error("Укажи корректный адрес электронной почты.");
    if(p.length<6)throw new Error("Пароль должен содержать минимум 6 символов.");
    if(p.length>128)throw new Error("Слишком длинный пароль.");
    return {email:e,password:p};
  }
  function explainError(err){
    var code=err&&err.code||"";
    var map={"auth/invalid-email":"Некорректный адрес электронной почты.","auth/user-disabled":"Этот аккаунт отключён.","auth/user-not-found":"Аккаунт не найден. Проверь почту или зарегистрируйся.","auth/wrong-password":"Неверный пароль.","auth/invalid-credential":"Неверная почта или пароль.","auth/email-already-in-use":"Эта почта уже зарегистрирована. Попробуй войти.","auth/weak-password":"Пароль слишком простой. Используй минимум 6 символов.","auth/network-request-failed":"Нет соединения. Проверь интернет.","auth/too-many-requests":"Слишком много попыток. Попробуй позже.","auth/operation-not-allowed":"Email/Password не включён в Firebase Authentication."};
    return map[code]||("Ошибка авторизации: "+(err&&err.message?err.message:"неизвестная ошибка"));
  }
  function showGate(show){gate.classList.toggle("hidden",!show);document.body.style.overflow=show?"hidden":"";}
  function readLegacyData(){
    var profile=null, save=null;
    try{profile=JSON.parse(localStorage.getItem("clicker-profile")||"null");}catch(e){}
    try{save=JSON.parse(localStorage.getItem("clicker-save")||"null");}catch(e){}
    return {profile:profile,save:save};
  }
  function hasLocalProgress(){
    return !!(localStorage.getItem("clicker-save")||localStorage.getItem("clicker-profile"));
  }
  function writeAccountRecord(user){
    if(!window.db||!user)return Promise.reject(new Error("Firebase Database не подключена."));
    var legacy=readLegacyData();
    var ref=window.db.ref("playerAccounts/"+user.uid);
    return ref.transaction(function(old){
      var now=Date.now();
      if(old){
        old.email=user.email||old.email||"";
        old.lastLoginAt=now;
        old.schemaVersion=2;
        // If this account was created by the earlier bootstrap, attach the
        // current browser's legacy data once, but never replace an existing snapshot.
        if(!old.migration&&(legacy.profile||legacy.save)){
          old.migration={status:"legacy_snapshot_saved",savedAt:now,profile:legacy.profile||null,save:legacy.save||null};
          old.nickname=old.nickname||legacy.profile&&legacy.profile.nickname||"";
          old.legacyProfileId=old.legacyProfileId||legacy.profile&&legacy.profile.id||"";
        }
        return old;
      }
      return {
        email:user.email||"",
        nickname:legacy.profile&&legacy.profile.nickname||"",
        legacyProfileId:legacy.profile&&legacy.profile.id||"",
        createdAt:legacy.profile&&legacy.profile.createdAt||now,
        lastLoginAt:now,
        schemaVersion:2,
        migration:{status:"legacy_snapshot_saved",savedAt:now,profile:legacy.profile||null,save:legacy.save||null}
      };
    }).then(function(result){
      if(!result.committed)throw new Error("Не удалось сохранить привязку аккаунта.");
      return result.snapshot.val();
    });
  }
  function restoreLegacySnapshot(record){
    if(!record||!record.migration||!record.migration.profile&&!record.migration.save)return false;
    // Never overwrite local progress. This restore is only for an empty browser profile.
    if(hasLocalProgress())return false;
    try{
      if(record.migration.profile)localStorage.setItem("clicker-profile",JSON.stringify(record.migration.profile));
      if(record.migration.save)localStorage.setItem("clicker-save",JSON.stringify(record.migration.save));
      localStorage.setItem("kro-account-uid",auth.currentUser.uid);
      return true;
    }catch(e){console.warn("Не удалось восстановить локальный прогресс:",e);return false;}
  }
  function onSignedIn(user){
    logout.classList.remove("hidden");
    say("Аккаунт подтверждён. Проверяю сохранение…",false);
    writeAccountRecord(user).then(function(record){
      var restored=restoreLegacySnapshot(record);
      showGate(false);
      say(restored?"Старый прогресс восстановлен.":"Вход выполнен.",false);
      window.dispatchEvent(new CustomEvent("kro-account-ready",{detail:{uid:user.uid,email:user.email||"",restored:restored}}));
      if(restored){setTimeout(function(){location.reload();},250);}
    }).catch(function(err){
      console.warn("Не удалось завершить привязку аккаунта:",err);
      say("Вход выполнен, но привязка прогресса не завершилась. Проверь Firebase Rules.",true);
      showGate(true);
    });
  }
  function run(action){
    if(busy)return;
    var c;try{c=credentials();}catch(e){say(e.message,true);return;}
    if(!auth){say("Firebase Auth не настроен. Добавь Web App config (apiKey и appId) в game.js.",true);return;}
    setBusy(true);say("Подключение…",false);
    var task=action==="register"?auth.createUserWithEmailAndPassword(c.email,c.password):auth.signInWithEmailAndPassword(c.email,c.password);
    task.then(function(){password.value="";say(action==="register"?"Аккаунт создан. Проверяю привязку прогресса…":"Вход выполнен. Проверяю привязку прогресса…",false);})
      .catch(function(err){say(explainError(err),true);})
      .finally(function(){setBusy(false);});
  }
  login.addEventListener("click",function(){run("login");});
  register.addEventListener("click",function(){run("register");});
  logout.addEventListener("click",function(){if(auth)auth.signOut().then(function(){location.reload();}).catch(function(e){say(explainError(e),true);});});
  password.addEventListener("keydown",function(e){if(e.key==="Enter")run("login");});
  function boot(){
    if(typeof firebase==="undefined"||!firebase.auth){say("Firebase Auth SDK не загрузился. Проверь интернет.",true);showGate(true);return;}
    if(!firebase.apps||!firebase.apps.length){say("Firebase App ещё не инициализирован.",true);showGate(true);return;}
    var cfg=firebase.app().options||{};
    if(!cfg.apiKey||String(cfg.apiKey).indexOf("PASTE_")===0||!cfg.appId||String(cfg.appId).indexOf("PASTE_")===0){say("Нужен Firebase Web App config: apiKey и appId. Профиль и сохранение не затронуты.",true);showGate(true);return;}
    try{auth=firebase.auth();auth.onAuthStateChanged(function(user){if(user)onSignedIn(user);else{showGate(true);logout.classList.add("hidden");say("Войди или создай аккаунт.",false);}});}
    catch(e){say(explainError(e),true);showGate(true);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
