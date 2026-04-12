/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Users, 
  GraduationCap, 
  Calendar as CalendarIcon, 
  Bell, 
  Wallet, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  ChevronLeft,
  Search,
  LogOut,
  UserCircle,
  Pencil,
  Trash2
} from 'lucide-react';
import { format, isAfter, isBefore, startOfDay, addDays, addMonths, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Teacher {
  id: string;
  name: string;
  registrationDate: string;
  course: string;
  sharePercentage: number;
  classesCount: number;
}

interface Student {
  id: string;
  name: string;
  phone: string;
  registrationDate: string;
  teacherId: string;
  paymentAmount: number;
  paymentType: 'monthly' | '12-days' | 'per-class';
  nextPaymentDate: string;
  totalPaid: number;
}

interface ClassSession {
  id: string;
  teacherId: string;
  studentId: string;
  date: string;
  description: string;
  amountPaid: number;
  amountDue: number;
  isAbsent: boolean;
  isTeacherPaid: boolean;
  teacherPaidAmount: number;
  teacherPaymentDate?: string;
}

// --- Components ---

export default function App() {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'teacher' | 'student' | 'all';
    id?: string;
    name?: string;
  } | null>(null);

  // Local Storage Initialization
  useEffect(() => {
    const storedTeachers = localStorage.getItem('teachers');
    const storedStudents = localStorage.getItem('students');
    const storedClasses = localStorage.getItem('classes');

    if (storedTeachers) setTeachers(JSON.parse(storedTeachers));
    if (storedStudents) setStudents(JSON.parse(storedStudents));
    if (storedClasses) setClasses(JSON.parse(storedClasses));
    
    setLoading(false);
  }, []);

  // Persistence
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('teachers', JSON.stringify(teachers));
      localStorage.setItem('students', JSON.stringify(students));
      localStorage.setItem('classes', JSON.stringify(classes));
    }
  }, [teachers, students, classes, loading]);

  const logout = () => {
    // In local mode, we don't really have a logout, but we can clear data if needed
    // or just do nothing. Let's just do nothing for now.
  };

  // Calculations
  const lateStudents = useMemo(() => {
    const today = startOfDay(new Date());
    return students.filter(s => {
      // Check if student has any unpaid classes
      const studentClasses = classes.filter(c => c.studentId === s.id);
      const hasUnpaidClasses = studentClasses.some(c => c.amountDue > 0);
      
      if (s.paymentType === 'per-class') {
        return hasUnpaidClasses;
      }

      const paymentDate = startOfDay(parseISO(s.nextPaymentDate));
      const isDateLate = isBefore(paymentDate, today);
      
      // A student is late if the due date has passed OR they have any unpaid classes
      return isDateLate || hasUnpaidClasses;
    });
  }, [students, classes]);

  const academyBalance = useMemo(() => {
    return classes.reduce((acc, c) => {
      const student = students.find(s => s.id === c.studentId);
      const teacher = teachers.find(t => t.id === c.teacherId);
      if (!student || !teacher) return acc;
      
      const teacherShare = (c.amountPaid * teacher.sharePercentage) / 100;
      const academyShare = c.amountPaid - (c.isTeacherPaid ? teacherShare : 0);
      return acc + academyShare;
    }, 0);
  }, [classes, students, teachers]);

  const getTeacherShares = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return [];
    return classes
      .filter(c => c.teacherId === teacherId)
      .map(c => {
        const totalShare = (c.amountPaid * teacher.sharePercentage) / 100;
        return {
          ...c,
          shareAmount: totalShare,
          unpaidShare: Math.max(0, totalShare - (c.teacherPaidAmount || 0))
        };
      });
  };

  const getTeacherUnpaidAmount = (teacherId: string) => {
    return getTeacherShares(teacherId)
      .reduce((acc, c) => acc + c.unpaidShare, 0);
  };

  const getStudentClasses = (studentId: string) => {
    return classes.filter(c => c.studentId === studentId);
  };

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editPaymentData, setEditPaymentData] = useState({ amountPaid: 0, amountDue: 0 });

  // Handlers
  const handleAddTeacher = (data: any) => {
    const newTeacher: Teacher = {
      ...data,
      id: crypto.randomUUID(),
      registrationDate: new Date().toISOString(),
      classesCount: 0,
    };
    setTeachers(prev => [...prev, newTeacher]);
    toast.success("تمت إضافة المعلم بنجاح");
  };

  const handleAddStudent = (data: any) => {
    const newStudent: Student = {
      ...data,
      id: crypto.randomUUID(),
      registrationDate: new Date().toISOString(),
      totalPaid: 0,
    };
    setStudents(prev => [...prev, newStudent]);
    toast.success("تمت إضافة الطالب بنجاح");
  };

  const handleAddClass = (data: any) => {
    const newClass: ClassSession = {
      ...data,
      id: crypto.randomUUID(),
      isTeacherPaid: false,
      teacherPaidAmount: 0,
    };
    setClasses(prev => [...prev, newClass]);
    
    // Update student total paid and potentially next payment date
    setStudents(prev => prev.map(s => {
      if (s.id === data.studentId) {
        let nextDate = s.nextPaymentDate;
        // If it's a full payment (or more) and not per-class, advance the date
        if (s.paymentType !== 'per-class' && (data.amountPaid || 0) >= s.paymentAmount) {
          const currentNext = parseISO(s.nextPaymentDate);
          const newNext = s.paymentType === 'monthly' ? addMonths(currentNext, 1) : addDays(currentNext, 12);
          nextDate = format(newNext, 'yyyy-MM-dd');
        }
        return { 
          ...s, 
          totalPaid: s.totalPaid + (data.amountPaid || 0),
          nextPaymentDate: nextDate
        };
      }
      return s;
    }));
    
    toast.success("تم تسجيل الحصة بنجاح");
  };

  const handlePayTeacher = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    setClasses(prev => prev.map(c => {
      if (c.teacherId === teacherId) {
        const totalShare = (c.amountPaid * teacher.sharePercentage) / 100;
        return { 
          ...c, 
          isTeacherPaid: true, 
          teacherPaidAmount: totalShare,
          teacherPaymentDate: new Date().toISOString() 
        };
      }
      return c;
    }));
    toast.success("تم تأكيد دفع مستحقات المعلم");
  };

  const handlePayPartial = (classSession: ClassSession, amount: number) => {
    if (amount <= 0 || amount > classSession.amountDue) {
      toast.error("المبلغ غير صالح");
      return;
    }

    setClasses(prev => prev.map(c => 
      c.id === classSession.id 
        ? { 
            ...c, 
            amountPaid: c.amountPaid + amount, 
            amountDue: c.amountDue - amount,
            isTeacherPaid: false
          }
        : c
    ));

    // Update student total paid
    setStudents(prev => prev.map(s => 
      s.id === classSession.studentId 
        ? { ...s, totalPaid: s.totalPaid + amount }
        : s
    ));

    toast.success("تم تسجيل الدفعة بنجاح");
  };

  const handleUpdateClassPayment = (classId: string, amountPaid: number, amountDue: number) => {
    const classSession = classes.find(c => c.id === classId);
    if (!classSession) return;

    const diff = amountPaid - classSession.amountPaid;

    setClasses(prev => prev.map(c => 
      c.id === classId 
        ? { 
            ...c, 
            amountPaid, 
            amountDue,
            isTeacherPaid: false
          }
        : c
    ));

    setStudents(prev => prev.map(s => 
      s.id === classSession.studentId 
        ? { ...s, totalPaid: s.totalPaid + diff }
        : s
    ));

    toast.success("تم تحديث بيانات الدفع بنجاح");
    setEditingClassId(null);
  };

  const handleDeleteTeacher = (teacherId: string) => {
    setTeachers(prev => prev.filter(t => t.id !== teacherId));
    // Also delete related students and classes? 
    // Usually better to just filter them out in UI or delete them too.
    // For simplicity, let's just delete the teacher.
    toast.success("تم حذف المعلم بنجاح");
    setDeleteConfirm(null);
  };

  const handleUpdateTeacher = (teacherId: string, data: Partial<Teacher>) => {
    setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, ...data } : t));
    toast.success("تم تحديث بيانات المعلم بنجاح");
  };

  const handleDeleteStudent = (studentId: string) => {
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setClasses(prev => prev.filter(c => c.studentId !== studentId));
    toast.success("تم حذف الطالب بنجاح");
    setDeleteConfirm(null);
  };

  const handleUpdateStudent = (studentId: string, data: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...data } : s));
    toast.success("تم تحديث بيانات الطالب بنجاح");
  };

  const handleDeleteAllData = () => {
    setTeachers([]);
    setStudents([]);
    setClasses([]);
    toast.success("تم مسح جميع البيانات بنجاح");
    setDeleteConfirm(null);
  };

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GraduationCap className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-bold">أكاديمية الجلاد</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-left items-end">
              <span className="text-sm font-medium">مدير النظام</span>
              <span className="text-xs text-slate-500">وضع محلي</span>
            </div>
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4 mr-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setDeleteConfirm({ type: 'all' })} 
                className="text-slate-400 hover:text-destructive text-xs"
              >
                <Trash2 className="w-4 h-4 ml-2" />
                مسح البيانات
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Top Stats & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-sm bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Wallet className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg font-medium opacity-80">إجمالي رصيد الأكاديمية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold mb-2">
                {academyBalance.toLocaleString()} <span className="text-2xl font-normal">شيكل</span>
              </div>
              <p className="text-sm opacity-70">بناءً على جميع الحصص المسجلة والمدفوعة</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-r-4 border-r-destructive">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-destructive" />
                  تنبيهات المتأخرين
                </CardTitle>
                <Badge variant="destructive">{lateStudents.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[120px]">
                {lateStudents.length > 0 ? (
                  <div className="space-y-3">
                    {lateStudents.map(s => {
                      const isDateLate = isBefore(startOfDay(parseISO(s.nextPaymentDate)), startOfDay(new Date()));
                      return (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg border border-destructive/10">
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-slate-500">
                              {isDateLate ? `تاريخ الاستحقاق: ${format(parseISO(s.nextPaymentDate), 'yyyy/MM/dd')}` : 'يوجد مبالغ غير مدفوعة'}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-destructive border-destructive">
                            {isDateLate ? 'متأخر' : 'ذمة'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8 text-sm">لا يوجد متأخرات حالياً</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="flex flex-wrap gap-4">
          <AddTeacherModal onAdd={handleAddTeacher} />
          <AddStudentModal teachers={teachers} onAdd={handleAddStudent} />
        </div>

        {/* Teachers & Students Section */}
        <Tabs defaultValue="teachers" className="w-full">
          <TabsList className="bg-white border border-slate-200 p-1 rounded-xl mb-6">
            <TabsTrigger value="teachers" className="rounded-lg px-8">المعلمون</TabsTrigger>
            <TabsTrigger value="students" className="rounded-lg px-8">الطلاب</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg px-8">سجل المدفوعات</TabsTrigger>
          </TabsList>

          <TabsContent value="teachers">
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المعلم</TableHead>
                    <TableHead className="text-right">الدورة</TableHead>
                    <TableHead className="text-right">النسبة</TableHead>
                    <TableHead className="text-right">عدد الحصص</TableHead>
                    <TableHead className="text-right">المستحقات غير المدفوعة</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map(t => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedTeacher(t)}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.course}</TableCell>
                      <TableCell>{t.sharePercentage}%</TableCell>
                      <TableCell>{classes.filter(c => c.teacherId === t.id).length}</TableCell>
                      <TableCell className="text-primary font-bold">
                        {getTeacherUnpaidAmount(t.id).toLocaleString()} شيكل
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={getTeacherUnpaidAmount(t.id) === 0}
                              onCheckedChange={() => handlePayTeacher(t.id)}
                              disabled={getTeacherUnpaidAmount(t.id) === 0}
                            />
                            <span className="text-xs text-slate-500">تأكيد الدفع</span>
                          </div>
                          <TeacherSharesModal 
                            teacher={t} 
                            shares={getTeacherShares(t.id)} 
                            students={students}
                          />
                          <div className="flex items-center gap-1">
                            <AddTeacherModal 
                              onAdd={(data) => handleUpdateTeacher(t.id, data)} 
                              editData={t} 
                            />
                            <Button 
                              variant="ghost" 
                              size="icon-xs" 
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirm({ type: 'teacher', id: t.id, name: t.name })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            
            {/* Teacher's Students List */}
            <AnimatePresence>
              {selectedTeacher && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-8"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">طلاب المعلم: {selectedTeacher.name}</h3>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTeacher(null)}>إغلاق</Button>
                  </div>
                  <Card className="border-none shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">اسم الطالب</TableHead>
                          <TableHead className="text-right">نوع الدفع</TableHead>
                          <TableHead className="text-right">القسط</TableHead>
                          <TableHead className="text-right">إجمالي المدفوع</TableHead>
                          <TableHead className="text-right">موعد الدفع القادم</TableHead>
                          <TableHead className="text-right">الإجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.filter(s => s.teacherId === selectedTeacher.id).map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>
                              {s.paymentType === 'monthly' ? 'شهري' : 
                               s.paymentType === '12-days' ? 'كل 12 يوم' : 'حسب الحصة'}
                            </TableCell>
                            <TableCell>{s.paymentType === 'per-class' ? 'حسب الحصة' : `${s.paymentAmount} شيكل`}</TableCell>
                            <TableCell>{s.totalPaid} شيكل</TableCell>
                            <TableCell>
                              {s.paymentType === 'per-class' ? (
                                <Badge variant="outline">حسب الحصة</Badge>
                              ) : (
                                <Badge variant={isBefore(parseISO(s.nextPaymentDate), new Date()) ? 'destructive' : 'outline'}>
                                  {format(parseISO(s.nextPaymentDate), 'yyyy/MM/dd')}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                                  setSelectedStudent(s);
                                  setIsCalendarOpen(true);
                                }}>
                                  <CalendarIcon className="w-4 h-4 ml-2" />
                                  سجل الحصص
                                </Button>
                                <AddStudentModal 
                                  teachers={teachers} 
                                  onAdd={(data) => handleUpdateStudent(s.id, data)} 
                                  editData={s} 
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon-xs" 
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteConfirm({ type: 'student', id: s.id, name: s.name })}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="students">
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">رقم الهاتف</TableHead>
                    <TableHead className="text-right">المعلم</TableHead>
                    <TableHead className="text-right">القسط</TableHead>
                    <TableHead className="text-right">موعد الدفع القادم</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-slate-500">{s.phone || '-'}</TableCell>
                      <TableCell>{teachers.find(t => t.id === s.teacherId)?.name}</TableCell>
                      <TableCell>{s.paymentType === 'per-class' ? 'حسب الحصة' : `${s.paymentAmount} شيكل`}</TableCell>
                      <TableCell>
                        {s.paymentType === 'per-class' ? (
                          <Badge variant="outline">حسب الحصة</Badge>
                        ) : (
                          <Badge variant={isBefore(parseISO(s.nextPaymentDate), new Date()) ? 'destructive' : 'outline'}>
                            {format(parseISO(s.nextPaymentDate), 'yyyy/MM/dd')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                            setSelectedStudent(s);
                            setIsCalendarOpen(true);
                          }}>
                            <CalendarIcon className="w-4 h-4 ml-2" />
                            سجل الحصص
                          </Button>
                          <AddStudentModal 
                            teachers={teachers} 
                            onAdd={(data) => handleUpdateStudent(s.id, data)} 
                            editData={s} 
                          />
                          <Button 
                            variant="ghost" 
                            size="icon-xs" 
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteConfirm({ type: 'student', id: s.id, name: s.name })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">المعلم</TableHead>
                    <TableHead className="text-right">المبلغ المدفوع</TableHead>
                    <TableHead className="text-right">حالة دفع المعلم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...classes].sort((a, b) => b.date.localeCompare(a.date)).map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{format(parseISO(c.date), 'yyyy/MM/dd')}</TableCell>
                      <TableCell>{students.find(s => s.id === c.studentId)?.name}</TableCell>
                      <TableCell>{teachers.find(t => t.id === c.teacherId)?.name}</TableCell>
                      <TableCell className="font-bold text-green-600">{c.amountPaid} شيكل</TableCell>
                      <TableCell>
                        {c.isTeacherPaid ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs">تم الدفع ({format(parseISO(c.teacherPaymentDate!), 'MM/dd')})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-600">
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">قيد الانتظار</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Student Calendar Modal */}
      <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>سجل حصص الطالب: {selectedStudent?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
            <div>
              <h4 className="font-bold mb-4">تسجيل حصة جديدة</h4>
              <ClassRegistrationForm 
                student={selectedStudent} 
                onAdd={handleAddClass} 
                onClose={() => setIsCalendarOpen(false)}
              />
            </div>
            
            <div className="space-y-6">
              <h4 className="font-bold">الحصص المسجلة</h4>
              <div className="space-y-4">
                {selectedStudent && getStudentClasses(selectedStudent.id).length > 0 ? (
                  getStudentClasses(selectedStudent.id).sort((a,b) => b.date.localeCompare(a.date)).map(c => (
                    <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold">{format(parseISO(c.date), 'EEEE, d MMMM', { locale: ar })}</span>
                        <Badge variant={c.isAbsent ? 'destructive' : 'secondary'}>
                          {c.isAbsent ? 'غائب' : 'حاضر'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{c.description || 'لا يوجد وصف'}</p>
                      <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            {editingClassId === c.id ? (
                              <div className="space-y-2 mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 w-12">المدفوع:</span>
                                  <Input 
                                    type="number" 
                                    className="h-7 text-xs w-20" 
                                    value={editPaymentData.amountPaid}
                                    onChange={e => setEditPaymentData({ ...editPaymentData, amountPaid: Number(e.target.value) })}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 w-12">المتبقي:</span>
                                  <Input 
                                    type="number" 
                                    className="h-7 text-xs w-20" 
                                    value={editPaymentData.amountDue}
                                    onChange={e => setEditPaymentData({ ...editPaymentData, amountDue: Number(e.target.value) })}
                                  />
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <Button size="xs" className="h-7 px-3" onClick={() => handleUpdateClassPayment(c.id, editPaymentData.amountPaid, editPaymentData.amountDue)}>حفظ</Button>
                                  <Button size="xs" variant="ghost" className="h-7 px-3" onClick={() => setEditingClassId(null)}>إلغاء</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs text-slate-500">المدفوع: <span className="font-bold text-slate-900">{c.amountPaid} شيكل</span></span>
                                <span className="text-xs text-slate-500">المتبقي: <span className="font-bold text-slate-900">{c.amountDue} شيكل</span></span>
                                <Button 
                                  variant="ghost" 
                                  size="xs" 
                                  className="h-6 px-1 text-[10px] text-primary hover:bg-primary/10 w-fit mt-1"
                                  onClick={() => {
                                    setEditingClassId(c.id);
                                    setEditPaymentData({ amountPaid: c.amountPaid, amountDue: c.amountDue });
                                  }}
                                >
                                  <Pencil className="w-3 h-3 ml-1" />
                                  تعديل المبالغ
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] text-slate-400 block">حصة المعلم</span>
                            <span className="text-xs font-bold text-primary">
                              {((c.amountPaid * (teachers.find(t => t.id === c.teacherId)?.sharePercentage || 0)) / 100).toFixed(2)} شيكل
                            </span>
                          </div>
                        </div>
                        
                        {c.amountDue > 0 && !editingClassId && (
                          <div className="flex gap-2">
                            <Input 
                              type="number" 
                              placeholder="المبلغ" 
                              className="h-8 text-xs"
                              id={`partial-${c.id}`}
                            />
                            <Button 
                              variant="outline" 
                              size="xs" 
                              className="text-[10px] h-8 border-primary text-primary hover:bg-primary hover:text-white shrink-0"
                              onClick={() => {
                                const input = document.getElementById(`partial-${c.id}`) as HTMLInputElement;
                                if (input) handlePayPartial(c, Number(input.value));
                              }}
                            >
                              دفع مبلغ
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-500 py-12">لا يوجد حصص مسجلة لهذا الطالب</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.type === 'teacher' && deleteConfirm.id) handleDeleteTeacher(deleteConfirm.id);
          else if (deleteConfirm?.type === 'student' && deleteConfirm.id) handleDeleteStudent(deleteConfirm.id);
          else if (deleteConfirm?.type === 'all') handleDeleteAllData();
        }}
        title={
          deleteConfirm?.type === 'teacher' ? 'حذف معلم' : 
          deleteConfirm?.type === 'student' ? 'حذف طالب' : 
          'مسح جميع البيانات'
        }
        message={
          deleteConfirm?.type === 'teacher' ? `هل أنت متأكد من حذف المعلم "${deleteConfirm?.name}"؟ سيتم حذف جميع البيانات المرتبطة به.` :
          deleteConfirm?.type === 'student' ? `هل أنت متأكد من حذف الطالب "${deleteConfirm?.name}"؟ سيتم حذف جميع البيانات المرتبطة به.` :
          'هل أنت متأكد تماماً من مسح جميع البيانات؟ هذا الإجراء سيقوم بحذف جميع المعلمين، الطلاب، وسجلات الحصص نهائياً ولا يمكن التراجع عنه.'
        }
      />
    </div>
  );
}

function DeleteConfirmDialog({ isOpen, onClose, onConfirm, title, message }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void,
  title: string,
  message: string
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1">تأكيد الحذف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Sub-components ---

function AddTeacherModal({ onAdd, editData }: { onAdd: (data: any) => void, editData?: Teacher }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: editData?.name || '',
    course: editData?.course || '',
    sharePercentage: editData?.sharePercentage || 50
  });

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name,
        course: editData.course,
        sharePercentage: editData.sharePercentage
      });
    }
  }, [editData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
    setOpen(false);
    if (!editData) setFormData({ name: '', course: '', sharePercentage: 50 });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        editData ? (
          <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:text-primary">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button className="rounded-xl px-6">
            <Plus className="ml-2 w-4 h-4" />
            إضافة معلم جديد
          </Button>
        )
      }>
        {editData ? null : 'إضافة معلم جديد'}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <div className="bg-primary p-6 text-white relative">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-2xl font-bold text-white">
              {editData ? 'تعديل بيانات معلم' : 'تسجيل معلم جديد'}
            </DialogTitle>
            <p className="text-primary-foreground/80 text-sm">أدخل تفاصيل المعلم لإضافته للنظام</p>
          </DialogHeader>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold">اسم المعلم</Label>
            <Input 
              required 
              className="rounded-xl border-slate-200 focus:ring-primary/20"
              placeholder="أدخل اسم المعلم الكامل"
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold">الدورة / المادة</Label>
            <Input 
              required 
              className="rounded-xl border-slate-200 focus:ring-primary/20"
              placeholder="مثال: لغة عربية، رياضيات..."
              value={formData.course} 
              onChange={e => setFormData({ ...formData, course: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold">نسبة المعلم (%)</Label>
            <Input 
              type="number" 
              required 
              min="0" 
              max="100" 
              className="rounded-xl border-slate-200 focus:ring-primary/20"
              value={formData.sharePercentage} 
              onChange={e => setFormData({ ...formData, sharePercentage: Number(e.target.value) })} 
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
              {editData ? 'تحديث البيانات' : 'حفظ المعلم'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeacherSharesModal({ teacher, shares, students }: { teacher: Teacher, shares: any[], students: Student[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-xs" />}>
        تفاصيل الحصص
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>سجل حصص المعلم: {teacher.name}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px] mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الطالب</TableHead>
                <TableHead className="text-right">المبلغ المدفوع</TableHead>
                <TableHead className="text-right">حصة المعلم</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shares.sort((a, b) => b.date.localeCompare(a.date)).map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{format(parseISO(s.date), 'yyyy/MM/dd')}</TableCell>
                  <TableCell className="text-xs font-medium">
                    {students.find(st => st.id === s.studentId)?.name || s.studentId}
                  </TableCell>
                  <TableCell className="text-xs">{s.amountPaid} شيكل</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">{s.shareAmount.toFixed(2)} شيكل</span>
                      {s.unpaidShare > 0 && s.unpaidShare < s.shareAmount && (
                        <span className="text-[10px] text-destructive">المتبقي: {s.unpaidShare.toFixed(2)} شيكل</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.unpaidShare === 0 ? (
                      <Badge variant="secondary" className="text-[10px]">تم الدفع</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">قيد الانتظار</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function AddStudentModal({ teachers, onAdd, editData }: { teachers: Teacher[], onAdd: (data: any) => void, editData?: Student }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: editData?.name || '',
    phone: editData?.phone || '',
    teacherId: editData?.teacherId || '',
    paymentAmount: editData?.paymentAmount || 0,
    paymentType: (editData?.paymentType || 'monthly') as 'monthly' | '12-days' | 'per-class',
    nextPaymentDate: editData?.nextPaymentDate || format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name,
        phone: editData.phone || '',
        teacherId: editData.teacherId,
        paymentAmount: editData.paymentAmount,
        paymentType: editData.paymentType,
        nextPaymentDate: editData.nextPaymentDate
      });
    }
  }, [editData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
    setOpen(false);
    if (!editData) {
      setFormData({
        name: '',
        phone: '',
        teacherId: '',
        paymentAmount: 0,
        paymentType: 'monthly',
        nextPaymentDate: format(new Date(), 'yyyy-MM-dd')
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        editData ? (
          <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:text-primary">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button variant="outline" className="rounded-xl px-6">
            <Plus className="ml-2 w-4 h-4" />
            تسجيل طالب جديد
          </Button>
        )
      }>
        {editData ? null : 'تسجيل طالب جديد'}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <div className="bg-primary p-6 text-white relative">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-2xl font-bold text-white">
              {editData ? 'تعديل بيانات طالب' : 'تسجيل طالب جديد'}
            </DialogTitle>
            <p className="text-primary-foreground/80 text-sm">أدخل تفاصيل الطالب لإضافته للنظام</p>
          </DialogHeader>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">اسم الطالب</Label>
              <Input 
                required 
                className="rounded-xl border-slate-200 focus:ring-primary/20"
                placeholder="أدخل اسم الطالب الكامل"
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">رقم الهاتف</Label>
              <Input 
                className="rounded-xl border-slate-200 focus:ring-primary/20"
                placeholder="05x-xxxxxxx"
                value={formData.phone} 
                onChange={e => setFormData({ ...formData, phone: e.target.value })} 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">المعلم</Label>
              <Select 
                required 
                value={formData.teacherId}
                onValueChange={v => setFormData({ ...formData, teacherId: v })}
              >
                <SelectTrigger className="rounded-xl border-slate-200">
                  <SelectValue placeholder="اختر المعلم">
                    {formData.teacherId ? teachers.find(t => t.id === formData.teacherId)?.name : "اختر المعلم"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">نوع الدفع</Label>
              <Select 
                value={formData.paymentType}
                onValueChange={(v: any) => setFormData({ ...formData, paymentType: v })}
              >
                <SelectTrigger className="rounded-xl border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="12-days">كل 12 يوم</SelectItem>
                  <SelectItem value="per-class">حسب الحصة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.paymentType !== 'per-class' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">مبلغ القسط (شيكل)</Label>
                <Input 
                  type="number" 
                  required 
                  className="rounded-xl border-slate-200"
                  value={formData.paymentAmount} 
                  onChange={e => setFormData({ ...formData, paymentAmount: Number(e.target.value) })} 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">تاريخ الدفع القادم</Label>
                <Input 
                  type="date" 
                  required 
                  className="rounded-xl border-slate-200"
                  value={formData.nextPaymentDate} 
                  onChange={e => setFormData({ ...formData, nextPaymentDate: e.target.value })} 
                />
              </div>
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
              {editData ? 'تحديث البيانات' : 'حفظ الطالب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassRegistrationForm({ student, onAdd, onClose }: { student: Student | null, onAdd: (data: any) => void, onClose: () => void }) {
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amountPaid: 0,
    amountDue: 0,
    isAbsent: false
  });

  if (!student) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...formData,
      studentId: student.id,
      teacherId: student.teacherId,
      date: new Date(formData.date).toISOString()
    });
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amountPaid: 0,
      amountDue: 0,
      isAbsent: false
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
      <div className="space-y-2">
        <Label>تاريخ الحصة</Label>
        <Input 
          type="date" 
          required 
          value={formData.date} 
          onChange={e => setFormData({ ...formData, date: e.target.value })} 
        />
      </div>
      <div className="space-y-2">
        <Label>وصف الحصة / الغرض</Label>
        <Input 
          placeholder="مثال: شرح الوحدة الأولى" 
          value={formData.description} 
          onChange={e => setFormData({ ...formData, description: e.target.value })} 
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>المبلغ المدفوع (شيكل)</Label>
          <Input 
            type="number" 
            value={formData.amountPaid} 
            onChange={e => setFormData({ ...formData, amountPaid: Number(e.target.value) })} 
          />
        </div>
        <div className="space-y-2">
          <Label>المبلغ المتبقي (شيكل)</Label>
          <Input 
            type="number" 
            value={formData.amountDue} 
            onChange={e => setFormData({ ...formData, amountDue: Number(e.target.value) })} 
          />
        </div>
      </div>
      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox 
          id="absent" 
          checked={formData.isAbsent} 
          onCheckedChange={(v: boolean) => setFormData({ ...formData, isAbsent: v })} 
        />
        <Label htmlFor="absent">تسجيل غياب الطالب</Label>
      </div>
      <Button type="submit" className="w-full">تسجيل الحصة والمدفوعات</Button>
    </form>
  );
}
