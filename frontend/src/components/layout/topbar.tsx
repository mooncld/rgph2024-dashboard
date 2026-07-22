import { SearchBar } from "@/components/search/search-bar";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  return (
    <header className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-white/5">
      <SearchBar />
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  );
}
