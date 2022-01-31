import { Bullseye, Form, FormGroup, TextInput, Button } from '@patternfly/react-core';
import { useRef } from 'react';
import { useAuthContext } from './context/auth';

function LoginForm() {
  const { login } = useAuthContext();
  const usernameRef = useRef();
  const passwordRef = useRef();

  const submitLogin = async () => {
    login(usernameRef.current.value, passwordRef.current.value);
  }

  return (
    <Bullseye>
      <Form>
        <FormGroup label="Username" fieldId="username">
          <TextInput isRequired type="text" id="username" ref={usernameRef} />
        </FormGroup>
        <FormGroup label="Password" fieldId="password">
          <TextInput isRequired type="password" id="password" ref={passwordRef} />
        </FormGroup>
        <Button variant="primary" onClick={submitLogin}>Login</Button>
      </Form>
    </Bullseye>
  );
}

export default LoginForm;
