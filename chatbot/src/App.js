import React from 'react';
import './App.css';
import ChatBotRobot from './Chatbot.component';

function App() {
  return (
    <span>
      <ChatBotRobot />
      <div className="App" style={{
          backgroundImage: `url(${require("./assets/bg.jpg")})`, backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          width: '100vw',
          height: '100vh'
      }}/>
    </span>
  );
}

export default App;
