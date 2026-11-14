import { useState, type FormEvent } from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { CREW } from "@/sim/crew"
import {
  SURGEON_EMAIL,
  accountForEmail,
  crewEmail,
  type Account,
} from "@/store/session"

/** shadcn login-03, adapted to Orb: crew and the flight surgeon sign in with their mission email. */
export function LoginForm({
  className,
  onSignIn,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  onSignIn: (account: Account) => void
}) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const account = accountForEmail(email)
    if (!account) {
      setError(
        `No one on this mission uses that email. Try ${crewEmail(CREW[0])}.`
      )
      return
    }
    onSignIn(account)
  }

  const pick = (value: string) => {
    setEmail(value)
    setError("")
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-white/10 shadow-2xl shadow-black/60 backdrop-blur-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with the mission email on your crew badge to see your
            own health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder={crewEmail(CREW[0])}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError("")
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "email-error" : undefined}
                  required
                />
                {error && <FieldError id="email-error">{error}</FieldError>}
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <button
                    type="button"
                    onClick={() =>
                      setNotice(
                        "Passwords are reset by the flight surgeon on Earth. In this demo any password works."
                      )
                    }
                    className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Forgot your password?
                  </button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" />
                {notice && (
                  <FieldDescription role="status">{notice}</FieldDescription>
                )}
              </Field>
              <Field>
                <Button type="submit">Sign in</Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <details className="group px-6 text-center text-sm text-muted-foreground">
        <summary className="cursor-pointer list-none underline underline-offset-4 hover:text-foreground [&::-webkit-details-marker]:hidden">
          Demo emails
        </summary>
        <ul className="mt-3 flex flex-col gap-1">
          {CREW.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => pick(crewEmail(c))}
              >
                {crewEmail(c)}{" "}
                <span className="text-muted-foreground/70">({c.role})</span>
              </button>
            </li>
          ))}
          <li className="mt-2 border-t border-white/10 pt-2">
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => pick(SURGEON_EMAIL)}
            >
              {SURGEON_EMAIL}{" "}
              <span className="text-muted-foreground/70">(Mission Control)</span>
            </button>
          </li>
        </ul>
      </details>
      <FieldDescription className="px-6 text-center">
        Simulated data for a NASA Space Apps entry. Not a medical device.
      </FieldDescription>
    </div>
  )
}
