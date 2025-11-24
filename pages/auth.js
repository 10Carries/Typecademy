import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA-FFNExXdT3jDTNZSJKi1jFaI_qCRTMUQ",
  authDomain: "typecademy-47e1a.firebaseapp.com",
  projectId: "typecademy-47e1a",
  storageBucket: "typecademy-47e1a.firebasestorage.app",
  messagingSenderId: "578378632896",
  appId: "1:578378632896:web:b71e02b0bf7eee7430a725",
  measurementId: "G-477KLYE97L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById("signup").onclick = async () => {
  const emailVal = email.value;
  const passwordVal = password.value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, emailVal, passwordVal);
    await sendEmailVerification(userCred.user);

    await setDoc(doc(db, "users", userCred.user.uid), {
      progress: {},
      created: Date.now(),
      email: emailVal
    });

    msg.textContent = "Verification email sent! Check your inbox.";
  } catch (e) {
    msg.textContent = e.message;
  }
};

document.getElementById("login").onclick = async () => {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email.value, password.value);

    if (!userCred.user.emailVerified) {
      msg.textContent = "Please verify your email first.";
      return;
    }

    window.location.href = "typing.html";  // redirect to lesson page
  } catch (e) {
    msg.textContent = e.message;
  }
};

document.getElementById("google-login").onclick = async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);

    const user = result.user;

    // If first login, create their progress document
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      await setDoc(userRef, {
        progress: {},      // initial save
        created: Date.now(),
        email: user.email
      });
    }

    // Redirect
    window.location.href = "typing.html";

  } catch (e) {
    msg.textContent = e.message;
  }
};
