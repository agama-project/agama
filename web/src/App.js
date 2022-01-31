import Overview from './Overview';
import LoginForm from './LoginForm';
import { useAuthContext, AuthProvider } from './context/auth';

function App() {
  const { state: { loggedIn } } = useAuthContext();

  const Component = loggedIn ? Overview : LoginForm;
  return <Component/>;
}

export default App;
