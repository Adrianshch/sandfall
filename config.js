// Sandfall settings. Edit the values below, then upload this file next to index.html.
// These values are safe to publish: the database rules decide what screens can do.
window.SANDFALL_CONFIG = {
  // Paste the firebaseConfig object from Firebase console > Project settings > Your apps.
  // It must include databaseURL (it appears after you create the Realtime Database).
  firebase: {
    apiKey: "PASTE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    appId: "PASTE_APP_ID"
  }
};

// The teacher code is NOT set here. It lives only in your database rules and in
// your teacher link (…/sandfall/#teacher-YOURCODE), so it never appears in this file.
