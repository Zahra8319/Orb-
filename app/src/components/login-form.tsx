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
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { CREW } from "@/sim/crew"
import { crewEmail, findCrewByEmail } from "@/store/session"

/** shadcn login-03, adapted to Orb: crew sign in with their mission email. */
export function LoginForm({
  className,
  onSignIn,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  onSignIn: (crewId: string) => void
}) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const crew = findCrewByEmail(email)
    if (!crew) {
      setError(
        `No crew member uses that email. Try ${crewEmail(CREW[0])}.`
      )
      return
    }
    onSignIn(crew.id)
  }

  const noSso = () =>
    setNotice(
      "Ship sign-on is offline in this demo. Use your mission email below."
    )

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-white/10 shadow-2xl shadow-black/60 backdrop-blur-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to see your own health on this mission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field>
                <Button variant="outline" type="button" onClick={noSso}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      fill="currentColor"
                    />
                  </svg>
                  Sign in with Apple
                </Button>
                <Button variant="outline" type="button" onClick={noSso}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Sign in with Google
                </Button>
                {notice && (
                  <FieldDescription role="status" className="text-center">
                    {notice}
                  </FieldDescription>
                )}
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-transparent">
                Or use your mission email
              </FieldSeparator>
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
          Demo crew emails
        </summary>
        <ul className="mt-3 flex flex-col gap-1">
          {CREW.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => {
                  setEmail(crewEmail(c))
                  setError("")
                }}
              >
                {crewEmail(c)}{" "}
                <span className="text-muted-foreground/70">({c.role})</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
      <FieldDescription className="px-6 text-center">
        Simulated data for a NASA Space Apps entry. Not a medical device.
      </FieldDescription>
    </div>
  )
}
