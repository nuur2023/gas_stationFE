import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../app/authSlice'
import { useAppDispatch } from '../app/hooks'

export function NoPermissionsPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  function handleBack() {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-xl rounded-2xl  bg-white p-8 text-center ">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-600 text-capitalize">
          Opps!, You Do Not Have Any Permissions Yet
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Please contact your administrator to grant access.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="mx-auto mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    </div>
  )
}
