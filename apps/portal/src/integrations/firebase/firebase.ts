import { getApp, getApps, initializeApp } from 'firebase/app'
import {
    type AuthCredential,
    GoogleAuthProvider,
    type Auth,
    confirmPasswordReset,
    createUserWithEmailAndPassword,
    getAuth,
    linkWithPopup,
    signInWithEmailAndPassword,
    signInWithCredential as signInWithCredentialFn,
    signInWithPopup,
    signOut,
    signInAnonymously,
    verifyPasswordResetCode,
} from 'firebase/auth'
import { type Firestore, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, type Functions, getFunctions } from 'firebase/functions'
import { type FirebaseStorage, getStorage } from 'firebase/storage'

class Firebase {
    auth: Auth
    db: Firestore
    functions: Functions
    googleProvider: GoogleAuthProvider
    storage: FirebaseStorage

    constructor() {
        const app =
            getApps().length > 0
                ? getApp()
                : initializeApp({
                      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
                      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                      appId: import.meta.env.VITE_FIREBASE_APP_ID,
                      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
                  })

        this.auth = getAuth(app)
        this.db = getFirestore(app)
        this.functions = getFunctions(app, 'australia-southeast1')
        if (['emulator', 'prod-local'].includes(import.meta.env.MODE)) {
            connectFunctionsEmulator(this.functions, 'localhost', 5001)
        }
        this.googleProvider = new GoogleAuthProvider()
        this.storage = getStorage(app)
    }

    doCreateUserWithEmailAndPassword = (email: string, password: string) =>
        createUserWithEmailAndPassword(this.auth, email, password)

    doSignInWithEmailAndPassword = (email: string, password: string) =>
        signInWithEmailAndPassword(this.auth, email, password)

    doSignInWithGoogle = () => signInWithPopup(this.auth, this.googleProvider)

    doSignOut = async () => {
        await signOut(this.auth)
        localStorage.removeItem('authUser')
    }

    signInAnonymously = () => signInAnonymously(this.auth)

    linkWithGoogle = () =>
        this.auth.currentUser ? linkWithPopup(this.auth.currentUser, this.googleProvider) : undefined

    signInWithCredential = (credential: AuthCredential) => signInWithCredentialFn(this.auth, credential)

    verifyPasswordResetCode = (oobCode: string) => verifyPasswordResetCode(this.auth, oobCode)

    confirmPasswordReset = (oobCode: string, newPassword: string) =>
        confirmPasswordReset(this.auth, oobCode, newPassword)
}

export default Firebase
