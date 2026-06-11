import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <div className="w-full rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>

          <form className="mt-6 space-y-4" action="/api/login" method="POST">
            <input
              name="email"
              type="email"
              required
              placeholder="admin@diam.com"
              className="w-full rounded-xl border px-4 py-3"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="1234"
              className="w-full rounded-xl border px-4 py-3"
            />

            <button className="w-full rounded-xl bg-black py-3 text-white">
              เข้าสู่ระบบ
            </button>

            <div className="text-sm text-gray-600">
              <Link href="/" className="underline">กลับหน้าแรก</Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}