import { createBrowserRouter } from "react-router-dom";

function Placeholder() {
  return <main className="grid min-h-screen place-items-center">FAQ Intelligence</main>;
}

export const router = createBrowserRouter([{ path: "/", element: <Placeholder /> }]);
