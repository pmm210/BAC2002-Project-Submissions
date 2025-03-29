import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";
import CharityPage from "./CharityPage";
import DonorPage from "./DonorPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/charity" element={<CharityPage />} />
        <Route path="/donor" element={<DonorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
