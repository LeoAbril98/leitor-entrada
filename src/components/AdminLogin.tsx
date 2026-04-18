import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AdminLoginProps {
    onLogin: () => void;
    onBack: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onBack }) => {
    const [password, setPassword] = useState("");
    const [isError, setIsError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Senha simples como solicitado
        if (password === 'admin123') {
            toast.success("Acesso Admin Liberado!");
            onLogin();
        } else {
            setIsError(true);
            toast.error("Senha incorreta");
            setTimeout(() => setIsError(false), 500);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full"
            >
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-widest">Voltar ao Menu</span>
                </button>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[80px] -mr-16 -mt-16" />

                    <div className="relative">
                        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-inner">
                            <Lock className="w-10 h-10" />
                        </div>

                        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">
                            Acesso Restrito
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-center mb-10 font-medium">
                            Digite a senha administrativa para continuar
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <motion.div
                                animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
                                transition={{ duration: 0.4 }}
                            >
                                <input
                                    type="password"
                                    autoFocus
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Senha de acesso"
                                    className="w-full h-16 px-6 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 transition-all text-center text-xl font-bold tracking-[0.5em] placeholder:tracking-normal placeholder:font-medium"
                                />
                            </motion.div>

                            <button
                                type="submit"
                                className="w-full h-16 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3 active:scale-95"
                            >
                                <ShieldCheck className="w-6 h-6 text-indigo-400 dark:text-white" />
                                Entrar no Painel
                            </button>
                        </form>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        Área de Gestão de Inventário
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
