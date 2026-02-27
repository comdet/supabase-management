declare module '@cubone/react-file-manager' {
    export interface FileActionParams {
        folder?: any;
        files?: any[];
        file?: any;
        name?: string;
        newName?: string;
    }

    export const FileManager: React.FC<any>;
}
