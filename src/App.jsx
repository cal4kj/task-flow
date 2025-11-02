import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import Sortable from 'sortablejs';
import { marked } from 'marked';
import './App.css';
import { loadTasks, saveTasks } from './storage.js';

marked.use({
  renderer: {
    link(href) {
      return `<a href="${href.href}" target="_blank" rel="noopener noreferrer">${href.text}</a>`;
    }
  }
});

// --- Helper Components & Functions ---
const isCircularDependency = (childId, potentialParentId, tasks) => {
    if (childId === potentialParentId) return true;
    let currentId = potentialParentId;
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    while (currentId) {
        const currentTask = taskMap.get(currentId);
        if (currentTask.dependsOn === childId) return true;
        currentId = currentTask.dependsOn;
    }
    return false;
};

const RoundedArrow = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="5" refX="3" refY="2.5" orient="auto">
                <polygon points="0 0, 4 2.5, 0 5" fill="#888" />
            </marker>
        </defs>
        <path d="M3 4V11C3 15.4183 6.58172 19 11 19H18" stroke="#888" strokeWidth="2" markerEnd="url(#arrowhead)" />
    </svg>
);

function App() {
    const [tasks, setTasks] = useState([]);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [linkingState, setLinkingState] = useState({ active: false, childId: null });

    const inlineEditorRef = useRef(null);
    const listRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        loadTasks((result) => {
            if (result.tasks) setTasks(result.tasks);
        });
    }, []);

    useEffect(() => {
        // The initial load can cause a save, this prevents saving an empty array over existing data.
        if (tasks.length > 0) {
            saveTasks(tasks);
        }
    }, [tasks]);

    useEffect(() => {
        if (listRef.current) {
            new Sortable(listRef.current, {
                handle: '.drag-handle',
                animation: 150,
                onEnd: (evt) => {
                    setTasks(currentTasks => {
                        const newTasks = [...currentTasks];
                        const movedItem = {... currentTasks[evt.oldIndex]};
                        newTasks.splice(evt.oldIndex, 1);
                        newTasks.splice(evt.newIndex, 0, movedItem);
                        return newTasks;
                    });
                }
            });
        }
    }, []);

    // --- Handlers ---
    const handleAddTask = () => {
        const newTask = { id: Date.now(), content: '', isCompleted: false, dependsOn: null };
        setTasks(prevTasks => [newTask, ...prevTasks]);
        setEditingTaskId(newTask.id);
    };

    const handleDeleteTask = (taskId) => {
        setTasks(tasks.filter(task => task.id !== taskId && task.dependsOn !== taskId));
    };

    const handleToggleComplete = (taskId) => {
        setTasks(tasks.map(task => task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task));
    };

    const handleEditorChange = (taskId) => {
        const newContent = inlineEditorRef.current.getInstance().getMarkdown();
        setTasks(currentTasks => currentTasks.map(task =>
            task.id === taskId ? { ...task, content: newContent } : task
        ));
    };

    const handleSaveTask = (task) => {
        if (task.content.trim() === '') {
            setTasks(currentTasks => currentTasks.filter(t => t.id !== task.id));
        }
        setEditingTaskId(null);
    };

    const handleEditorKeydown = (event, task) => {
        // Check for Command+Enter (Mac) or Ctrl+Enter (Windows/Linux)
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            handleSaveTask(task);
            event.preventDefault();
        }
    };

    const handleStartLinking = (childId) => setLinkingState({ active: true, childId });

    const handleSetDependency = (parentTask) => {
        if (!linkingState.active || isCircularDependency(linkingState.childId, parentTask.id, tasks)) return;
        setTasks(tasks.map(task => task.id === linkingState.childId ? { ...task, dependsOn: parentTask.id } : task));
        setLinkingState({ active: false, childId: null });
    };

    const handleRemoveDependency = (childId) => {
        setTasks(tasks.map(task => task.id === childId ? { ...task, dependsOn: null } : task));
    };

    const handleExportTasks = () => {
        const json = JSON.stringify(tasks, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tasks.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportTasks = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedTasks = JSON.parse(e.target.result);
                // Basic validation to ensure it's an array of objects
                if (Array.isArray(importedTasks) && importedTasks.every(item => typeof item === 'object' && item !== null)) {
                    setTasks(importedTasks);
                } else {
                    alert('Invalid JSON format. Please provide a JSON array of tasks.');
                }
            } catch (error) {
                alert('Error parsing JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    // --- Rendering Logic ---
    const hierarchicalTasks = useMemo(() => {
        const taskMap = new Map(tasks.map(task => [task.id, { ...task, children: [] }]));
        const topLevelTasks = [];
        for (const task of tasks) {
            if (task.dependsOn && taskMap.has(task.dependsOn)) {
                taskMap.get(task.dependsOn).children.push(taskMap.get(task.id));
            } else {
                topLevelTasks.push(taskMap.get(task.id));
            }
        }
        const flatList = [];
        function flatten(tasks, level) {
            for (const task of tasks) {
                flatList.push({ ...task, level });
                if (task.children.length) flatten(task.children, level + 1);
            }
        }
        flatten(topLevelTasks, 0);
        return flatList;
    }, [tasks]);

    return (
        <div className={`container mt-4 pb-4 ${linkingState.active ? 'is-linking' : ''}`}>

            <ul ref={listRef} className="list-group">
                {hierarchicalTasks.map(task => {
                    const isBeingEdited = editingTaskId === task.id;
                    const canBeParent = linkingState.active && !isCircularDependency(linkingState.childId, task.id, tasks);

                    return (
                        <li key={task.id} data-id={task.id} className={`list-group-item ${canBeParent ? 'can-be-parent' : ''}`}>
                            <div className="indentation-area" style={{ width: task.level * 40 + 'px' }}>
                                {task.level > 0 && <RoundedArrow />}
                            </div>
                            <div className="task-body">
                                <span className="drag-handle">&#x2630;</span>
                                <input type="checkbox" className="form-check-input task-checkbox" checked={task.isCompleted} onChange={() => handleToggleComplete(task.id)} disabled={isBeingEdited} />
                                
                                {isBeingEdited ? (
                                    <div className="w-100">
                                        <div onKeyDown={(e) => handleEditorKeydown(e, task)}>
                                            <Editor 
                                                ref={inlineEditorRef} 
                                                initialValue={task.content} 
                                                height="160px" 
                                                initialEditType="markdown" 
                                                hideModeSwitch={true} 
                                                toolbarItems={[]} 
                                                previewStyle="vertical"
                                                onChange={() => handleEditorChange(task.id)}
                                            />
                                        </div>
                                        <div className="text-end">
                                            <button 
                                                onClick={() => handleSaveTask(task)} 
                                                className="btn btn-success btn-sm mt-2"
                                                title="Save (Cmd+Enter)"
                                            >
                                                ✓ Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`task-content ${task.isCompleted ? 'completed' : ''}`} onDoubleClick={() => linkingState.active ? handleSetDependency(task) : setEditingTaskId(task.id)}>
                                            <div dangerouslySetInnerHTML={{ __html: marked.parse(task.content || '<p><em>Double-click to add content...</em></p>') }} />
                                        </div>
                                        {task.dependsOn ? (
                                            <button onClick={() => handleRemoveDependency(task.id)} className="btn btn-link btn-sm dependency-btn" title="Remove dependency">-🔗</button>
                                        ) : (
                                            <button onClick={() => handleStartLinking(task.id)} className="btn btn-link btn-sm dependency-btn" title="Add dependency">🔗</button>
                                        )}
                                        <button onClick={() => handleDeleteTask(task.id)} className="btn btn-danger btn-sm delete-btn">Delete</button>
                                    </>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="action-button d-flex justify-content-between align-items-center mt-3">
                {linkingState.active ? (
                    <button onClick={() => setLinkingState({ active: false, childId: null })} className="btn btn-warning">Cancel Linking</button>
                ) : (
                    <div className="btn-group">
                        <button type="button" className="btn btn-primary" onClick={handleAddTask}>+</button>
                        <button type="button" className="btn btn-primary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false">
                            <span className="visually-hidden">Toggle Dropdown</span>
                        </button>
                        <ul className="dropdown-menu">
                            <li><a className="dropdown-item" href="#" onClick={handleExportTasks}>Export Tasks</a></li>
                            <li>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportTasks}
                                    style={{ display: 'none' }}
                                    id="import-file-input"
                                />
                                <label className="dropdown-item" htmlFor="import-file-input" style={{ cursor: 'pointer' }}>Import Tasks</label>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
