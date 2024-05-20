import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { AppMachineContext } from '../App';
import { UserState } from '../machines/app.machine';
import { Footer } from './Footer';
import { Header } from './Header';
import { getStateValueStrings } from '../utils/states';

export const AppLayout: React.FC = () => {
  const current = AppMachineContext.useSelector(s => s);
  const userState =
    (getStateValueStrings(current.value).find(state => state.includes("user.")) as UserState) ||
    "user.unauthenticated";
  return (
    <>
      <Header userState={userState} currentUser={current.context.user} />
      <Outlet />
      <Footer />
    </>
  )
}
