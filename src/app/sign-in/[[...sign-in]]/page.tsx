"use client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
