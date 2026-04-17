import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
import { Fragment } from "react";

interface FileBreadcrumbProps {
    path: string;
    onNavigate: (path: string) => void;
}

export function FileBreadcrumb({ path, onNavigate }: FileBreadcrumbProps) {
    const parts = path ? path.split("/").filter(Boolean) : [];

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink
                        className="cursor-pointer flex items-center gap-1"
                        onClick={() => onNavigate("")}
                    >
                        <Home className="h-3.5 w-3.5" />
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {parts.map((part, i) => {
                    const subPath = parts.slice(0, i + 1).join("/");
                    return (
                        <Fragment key={subPath}>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbLink
                                    className="cursor-pointer"
                                    onClick={() => onNavigate(subPath)}
                                >
                                    {part}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
