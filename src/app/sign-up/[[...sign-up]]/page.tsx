"use client";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}
