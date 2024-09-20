import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Assistant from './pages/assistant';
import Home from './pages/Home';

const App = () => {
  return (
    <Router>
      <div>
        {/* <Navbar /> */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/assistant" element={<Assistant />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;