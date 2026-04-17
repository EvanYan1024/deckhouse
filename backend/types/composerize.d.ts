declare module "composerize" {
    function composerize(command: string, existingYaml?: string, composeVersion?: string): string;
    export = composerize;
}
