import { apiFetch } from "../lib/api";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Show } from "@clerk/react";
import {
	StoreIcon,
	//LogInIcon,
	PackageIcon,
	SettingsIcon,
	ShoppingBagIcon,
	//ShoppingCartIcon,
} from "lucide-react";
import { Link } from "react-router";
export default function Navbar() {
	const { getToken, isSignedIn } = useAuth();

	const { data: meData } = useQuery({
		queryKey: ["me"],
		queryFn: () => apiFetch("/api/me", { getToken }),
		enabled: isSignedIn,
	});
	const role: string = meData?.user?.role;

	return (
		<div>
			<header className="sticky top-0 z-50 borded-b border-base-300 bg-base-100/95 shadow -sm backdrop-blur-md">
				<div className="navbar mx-auto min-h-14 max-w-7xl px-4 py-2.5 md:px-6 md:py-3">
					<div className="flex-1">
						<Link
							to="/"
							className="btn btn-ghost gap-2 px-2 font-mono text-lg font-semibold uppercase tracking-wide md:text-xl"
						>
							<span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 p-1 text-primary">
								<StoreIcon className="size-8" aria-hidden />
							</span>
							<span className="leading-none">Nortwind</span>
						</Link>
					</div>
					<nav className="flex items-center gap-1 md:gap-1.5">
						<Link to="/" className="btn btn-ghost gap-2 font-medium">
							<ShoppingBagIcon className="size-6 opacity-90" aria-hidden />
							<span className="hidden sm:inline">Shop</span>
						</Link>
						<Show when={"signed-in"}>
							<Link to="/orders" className="btn btn-ghost gap-2 font-medium">
								<PackageIcon className="size-6 opacity-90" aria-hidden />
								<span className="hidden sm:inline">Orders</span>
							</Link>
							{role === "admin" ? (
								<Link
									to="/admin"
									className="btn btn-ghost gap-2 font-medium text-secondary"
								>
									<SettingsIcon className="size-6" aria-hidden />
									<span className="hidden sm:inline">Admin</span>
								</Link>
							) : null}
						</Show>
					</nav>
				</div>
			</header>
		</div>
	);
}
